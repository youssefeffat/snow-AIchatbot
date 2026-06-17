api.controller = function ($scope, $window, $timeout, $sce, $location, $sanitize) {
    var c = this;

    // --- CONFIG ---
    c.showContactMenu = false;
    c.isRenaming = false;
    c.newMessageText = '';
    c.isBotTyping = false;
    c.showMessageOverlay = { visible: false };
    c.showLimitAlert = false;
    c.limitAlertText = '';
    c.suggestions = [];

    c.activeMenuId = null;
    c.showSessionMenu = false;
    c.isMobile = $window.innerWidth <= 768;
    c.isCollapsed = c.isMobile;

    const BOT_TYPE = 'agent';
    const USER_TYPE = 'user';
    const AI_ACTIONS = {
        SHOW_KB: 'SHOW_KB',
        SHOW_TEXT: 'SHOW_TEXT',
        ASK_CONFIRM: 'ASK_CONFIRM'
    };
    const DECISION_TYPES = {
        APPROVE: 'approve',
        REJECT: 'reject'
    };
    const SERVER_ACTIONS = {
        SUBMIT_APPROVAL: 'submit_approval',
        SEND_MESSAGE: 'send_message_with_reply',
        CREATE_CONVERSATION: 'create_new_conversation',
        DISABLE_CONVERSATION: 'disable_conversation',
        FETCH_MESSAGES: 'fetch_messages',
        RENAME_CONVERSATION: 'rename_conversation'
    };

    // Defaults using I18N
    const DEFAULT_ACTIVE = {
        id: null,
        number: '',
        name: c.data.i18n.default_no_active,
        avatar: '??',
        unread: 0,
        lastMessage: '',
        isActive: false
    };

    // --- PARSERS ---
    c.renderMarkdown = function (htmlContent) {
        if (!htmlContent) return '';
        var text = $sce.getTrustedHtml(htmlContent) || htmlContent.toString();
        text = text.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
        text = text.replace(/\*(.*?)\*/g, '<em>$1</em>');
        text = text.replace(/```([\s\S]*?)```/g, '<pre><code>$1</code></pre>');
        text = text.replace(/`([^`]+)`/g, '<code class="inline-code">$1</code>');
        text = text.replace(/\n/g, '<br>');
        return $sce.trustAsHtml(text);
    };

    function parseJson(str) {
        if (!str || typeof str !== 'string') return null;
        var trimmed = str.trim();
        if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
            try { return JSON.parse(trimmed); } catch (e) { return null; }
        }
        return null;
    }

    function normalizePayload(wrapper) {
        if (!wrapper) return null;
        let payload = (wrapper && wrapper.data) ? wrapper.data : wrapper;
        
        if (payload) {
            // Normalize SHOW_KB to SHOW_TEXT for standard text greetings
            if (payload.action === AI_ACTIONS.SHOW_KB && !payload.kb_suggestions && !payload.items) {
                payload.action = AI_ACTIONS.SHOW_TEXT;
            }
            
            // Normalize ASK_CONFIRM (Hoist draft details)
            if (payload.action === AI_ACTIONS.ASK_CONFIRM && payload.confirm_INC_Creation && payload.confirm_INC_Creation.draft) {
                payload.confirm_INC_Creation = payload.confirm_INC_Creation.draft;
            }
        }
        
        return payload;
    }

    // --- INIT ---
    c.conversations = c.data.conversations || [];
    let initialActive = c.conversations.find(convo => convo.id === c.data.active_sys_id);
    c.activeConversation = initialActive || DEFAULT_ACTIVE;

    c.activeConversation.number = c.activeConversation.number || '';
    c.activeConversation.name = c.activeConversation.name || c.data.i18n.default_chat_name;
    c.activeConversation.lastMessage = c.activeConversation.lastMessage || '';
    if (c.activeConversation.isActive === undefined) c.activeConversation.isActive = true;

    c.maxChatsReached = c.data.max_conversations_reached || false;

    // c.messages comes from server 'data.messages' (Array)
    c.messages = (c.data.messages || []).map(processMessage);
    c.isLoading = false;

    function processMessage(msg) {
        let sanitizedText = $sanitize(msg.text);
        let wrapper = (msg.type === BOT_TYPE) ? parseJson(msg.text) : null;
        let parsedPayload = normalizePayload(wrapper);
        return {
            type: msg.type,
            text: $sce.trustAsHtml(sanitizedText),
            payload: parsedPayload,
            timestamp: msg.timestamp || ''
        };
    }

    c.handleBotAction = function (action, payload) {
        if (!c.activeConversation.isActive) return;
        if (payload.action_processed) return;
        payload.action_processed = true;

        if (action === 'confirm') {
            c.sendApproval(DECISION_TYPES.APPROVE);
        } else if (action === 'cancel') {
            c.sendApproval(DECISION_TYPES.REJECT);
        }
    };

    c.sendApproval = function(decisionType) {
        if (!c.activeConversation.isActive || !c.activeConversation.id) return;

        let now = new Date();
        let displayDecision = decisionType === DECISION_TYPES.APPROVE ? 'Decision: Approved' : 'Decision: Rejected';
        
        c.messages.push({
            type: USER_TYPE,
            text: $sce.trustAsHtml($sanitize(displayDecision)),
            timestamp: now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        });

        $timeout(autoResizeTextarea, 0);
        scrollToBottom();
        c.isBotTyping = true;

        let requestPayload = {
            action: SERVER_ACTIONS.SUBMIT_APPROVAL,
            conversation_id: c.activeConversation.id,
            decision_type: decisionType
        };

        c.server.get(requestPayload).then(function (response) {
            c.isBotTyping = false;

            let rawResponse = response.data.bot_message_content;
            let wrapper = parseJson(rawResponse);
            let payload = normalizePayload(wrapper);
            let displayText = (payload && payload.text) ? payload.text : rawResponse;

            let botNow = new Date();
            c.messages.push({
                type: BOT_TYPE,
                text: $sce.trustAsHtml($sanitize(displayText || '')),
                payload: payload,
                timestamp: botNow.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
            });

            scrollToBottom();
        }, function() {
            c.isBotTyping = false;
        });
    };

    c.sendMessage = function (overrideQuery, options) {
        if (!c.activeConversation.isActive) return;

        let userQuery = overrideQuery || c.newMessageText;
        if (!userQuery || !userQuery.trim() || !c.activeConversation.id) return;

        c.suggestions = [];

        let now = new Date();
        c.messages.push({
            type: USER_TYPE,
            text: $sce.trustAsHtml($sanitize(userQuery)),
            timestamp: now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        });

        c.newMessageText = '';
        $timeout(autoResizeTextarea, 0);
        scrollToBottom();
        c.isBotTyping = true;
        resetInputHeight();

        let requestPayload = {
            action: SERVER_ACTIONS.SEND_MESSAGE,
            conversation_id: c.activeConversation.id,
            message_type: USER_TYPE,
            message_text: userQuery,
            force_tool: (options && options.force_tool) ? options.force_tool : null,
            force_arguments: (options && options.force_arguments) ? options.force_arguments : null
        };

        c.server.get(requestPayload).then(function (response) {
            c.isBotTyping = false;

            let rawResponse = response.data.bot_message_content;
            let wrapper = parseJson(rawResponse);
            let payload = normalizePayload(wrapper);
            let displayText = (payload && payload.text) ? payload.text : rawResponse;

            let botNow = new Date();
            c.messages.push({
                type: BOT_TYPE,
                text: $sce.trustAsHtml($sanitize(displayText || '')),
                payload: payload,
                timestamp: botNow.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
            });

            let previewSource = (displayText !== undefined && displayText !== null) ? ('' + displayText) : '';
            let preview = previewSource.replace(/<[^>]*>?/gm, '');

            if (payload && payload.action && payload.action !== 'SHOW_TEXT') {
                preview = '[' + payload.action + '] ' + preview;
            }

            c.activeConversation.lastMessage = (preview || '').substring(0, 40);

            if (response.data.updated_conversation_name) {
                c.activeConversation.name = response.data.updated_conversation_name || c.activeConversation.name;
                let idx = c.conversations.findIndex(convo => convo.id === c.activeConversation.id);
                if (idx > -1) c.conversations[idx].name = c.activeConversation.name;
            }

            if (response.data.conversation_number) {
                c.activeConversation.number = response.data.conversation_number || c.activeConversation.number;
                let idx2 = c.conversations.findIndex(convo => convo.id === c.activeConversation.id);
                if (idx2 > -1) c.conversations[idx2].number = c.activeConversation.number;
            }

            scrollToBottom();
        }, function () {
            c.isBotTyping = false;
        });
    };

    c.toggleConvoMenu = function (convoId, event) {
        if (event) event.stopPropagation();
        if (c.activeMenuId === convoId) c.activeMenuId = null;
        else c.activeMenuId = convoId;
    };

    c.toggleSessionActionsMenu = function (event) {
        if (event) event.stopPropagation();
        c.showSessionMenu = !c.showSessionMenu;
    };

    c.startNewChat = function () {
        if (c.maxChatsReached) {
            c.limitAlertText = c.data.i18n.alert_limit_reached_client;
            c.showLimitAlert = true;
            $timeout(function () { c.showLimitAlert = false; }, 4000);
            return;
        }

        c.isLoading = true;
        c.server.get({ action: SERVER_ACTIONS.CREATE_CONVERSATION, name: c.data.i18n.default_new_chat_name }).then(function (response) {

            if (response.data.limit_error) {
                c.isLoading = false;

                if (response.data.limit_error === 'active_limit') {
                    c.limitAlertText = c.data.i18n.alert_max_active_server;
                    c.maxChatsReached = true;
                }
                else if (response.data.limit_error === 'closed_limit') {
                    c.limitAlertText = c.data.i18n.alert_max_closed_server;
                }

                c.showLimitAlert = true;
                $timeout(function () { c.showLimitAlert = false; }, 5000);
                return;
            }

            let newSysId = response.data.new_sys_id;
            if (newSysId) {
                let newConvo = {
                    id: newSysId,
                    number: response.data.new_number || '',
                    name: c.data.i18n.default_new_chat_name,
                    avatar: 'NC',
                    lastMessage: c.data.i18n.default_init_msg,
                    unread: 0,
                    isActive: true,
                    state: 'open'
                };

                c.conversations.unshift(newConvo);
                c.selectConversation(newSysId);

                c.limitAlertText = "";
                c.activeMenuId = null;
                c.showSessionMenu = false;
                c.startRename();
            }
            c.isLoading = false;
        });
    };

    c.deleteChat = function (sysId, event) {
        if (event) {
            event.preventDefault();
            event.stopPropagation();
        }

        if (!sysId) return;

        c.activeMenuId = null;
        c.showSessionMenu = false;

        if (c.activeConversation.id !== sysId) {
            c.selectConversation(sysId);
        }

        $timeout(function () {
            c.showMessageOverlay = {
                visible: true,
                text1: c.data.i18n.dialog_disable_title,
                text2: c.data.i18n.dialog_disable_body,
                confirmLabel: c.data.i18n.btn_disable,
                confirmAction: function () {
                    c.hideMessageOverlay();

                    c.server.get({ action: SERVER_ACTIONS.DISABLE_CONVERSATION, sys_id: sysId }).then(function () {
                        let index = c.conversations.findIndex(convo => convo.id === sysId);
                        if (index > -1) {
                            c.conversations[index].isActive = false;
                            c.conversations[index].avatar = 'CL';
                        }

                        if (c.activeConversation.id === sysId) {
                            c.activeConversation.isActive = false;
                        }

                        c.maxChatsReached = false;
                    });
                }
            };
        }, 100);
    };

    c.selectConversation = function (id) {
        c.activeMenuId = null;
        c.showSessionMenu = false;
        c.showContactMenu = false;

        let selected = c.conversations.find(convo => convo.id === id);
        if (selected && selected.id !== c.activeConversation.id) {
            c.activeConversation = selected;

            c.activeConversation.number = c.activeConversation.number || '';
            c.activeConversation.name = c.activeConversation.name || c.data.i18n.default_chat_name;
            c.activeConversation.lastMessage = c.activeConversation.lastMessage || '';

            if (c.activeConversation.isActive === undefined) c.activeConversation.isActive = true;

            c.activeConversation.unread = 0;
            loadMessages(id);
            if (c.isMobile) c.isCollapsed = true;
        }
    };

    function loadMessages(conversationId) {
        if (!conversationId) return;
        c.isLoading = true;
        c.messages = [];
        c.server.get({ action: SERVER_ACTIONS.FETCH_MESSAGES, active_sys_id: conversationId }).then(function (response) {
            $timeout(function () {
                c.messages = (response.data.messages || []).map(processMessage);
                c.isLoading = false;
                scrollToBottom(true);
            }, 0);
        });
    }

    c.startRename = function () {
        if (!c.activeConversation.id || !c.activeConversation.isActive) return;

        c.activeMenuId = null;
        c.showSessionMenu = false;

        c.isRenaming = true;
        $timeout(() => {
            var input = $window.document.querySelector('.rename-input');
            if (input) input.focus();
        }, 0);
    };

    c.finishRename = function () {
        if (!c.activeConversation.id) return;
        if (!c.activeConversation.name || !c.activeConversation.name.trim()) c.activeConversation.name = c.data.i18n.default_chat_name;
        c.isRenaming = false;
        c.server.get({ action: SERVER_ACTIONS.RENAME_CONVERSATION, sys_id: c.activeConversation.id, name: c.activeConversation.name });
    };

    c.handleRenameKeydown = function (event) {
        if (event.key === 'Enter') { event.preventDefault(); c.finishRename(); }
    };

    c.handleKeydown = function (event) {
        if (event.key === 'Enter' && !event.shiftKey) {
            event.preventDefault();
            c.sendMessage();
        }
    };

    c.detectIntent = function () { };

    function autoResizeTextarea() {
        var el = document.getElementById('chat-textarea');
        if (!el) return;
        var chatContainer = document.getElementById('chat-messages-container');
        if (!chatContainer) return;
        const maxHeight = Math.floor(chatContainer.clientHeight * 0.25);
        el.style.height = 'auto';
        if (el.scrollHeight > maxHeight) {
            el.style.height = maxHeight + 'px';
            el.classList.add('scrollable');
        } else {
            el.style.height = el.scrollHeight + 'px';
            el.classList.remove('scrollable');
        }
    }

    $scope.$watch('c.newMessageText', function () {
        autoResizeTextarea();
    });

    function resetInputHeight() {
        var el = document.getElementById('chat-textarea');
        if (el) el.style.height = 'auto';
    }

    c.hideMessageOverlay = function () { c.showMessageOverlay.visible = false; };
    c.toggleContactMenu = function () { c.showContactMenu = !c.showContactMenu; };
    c.toggleSidebar = function () { c.isCollapsed = !c.isCollapsed; };

    function scrollToBottom(instant = false) {
        $timeout(() => {
            let container = document.getElementById('chat-messages-container');
            if (container) {
                container.scrollTo({
                    top: container.scrollHeight,
                    behavior: instant ? 'instant' : 'smooth'
                });
            }
        }, 100);
    }

    if ($location.search().sys_id) {
        let target = c.conversations.find(convo => convo.id === $location.search().sys_id);
        if (target) c.selectConversation(target.id);
    }

    var closeMenus = function (e) {
        if (c.activeMenuId !== null || c.showSessionMenu === true || c.showContactMenu === true) {
            $scope.$apply(function () {
                if (!e.target.closest('.menu-toggle') && !e.target.closest('.menu-btn')) {
                    c.activeMenuId = null;
                    c.showSessionMenu = false;
                    c.showContactMenu = false;
                }
            });
        }
    };

    $window.document.addEventListener('click', closeMenus);
    $scope.$on('$destroy', function () {
        $window.document.removeEventListener('click', closeMenus);
    });

    scrollToBottom(true);
};