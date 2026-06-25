/**
 * GeoVAConversationService is a utility class for managing AI-powered conversations.
 * It encapsulates all business logic for creating, retrieving, and interacting with
 * conversation and message records, and for communicating with a backend AI gateway.
 */
var GeoVAConversationService = Class.create();
GeoVAConversationService.prototype = {

    /**
     * Initializes the service with user, configuration, and table information.
     * Provides safe defaults if configuration is not provided.
     *
     * @param {string} [userID] - The Sys ID of the user. Defaults to the current user.
     * @param {object} [config] - Configuration object for the service.
     * @param {number} [config.max_active_chats=3] - Max number of active chats allowed.
     * @param {number} [config.max_closed_chats=7] - Max number of historical chats to keep.
     * @param {string} [config.gateway_url] - The URL of the AI gateway to send messages to.
     * @param {number} [config.gateway_timeout=20000] - Timeout in ms for the AI gateway.
     * @param {object} [tables] - Object defining the table names to use.
     * @param {string} [tables.conv='u_geo_va_conversation'] - The conversation table.
     * @param {string} [tables.msg='u_geo_va_message'] - The message table.
     */
    initialize: function (userID, config, tables) {
        this.userID = userID || gs.getUserID();

        var defaultConfig = {
            max_active_chats: 3,
            max_closed_chats: 7,
            gateway_url: gs.getProperty('global.gateway_url', 'https://dev-agent-snow-corp-ais-dev.apps.ic2dr6fr.westeurope.aroapp.io/api/v1/chat'),
            gateway_timeout: 20000,
            include_history: true,
            history_limit: 10,
            mid_server: gs.getProperty('global.geova.mid_server', '')
        };
        this.config = global.JSUtil.notNil(config) ? config : defaultConfig;
        
        this.authService = new GeoVAAuthService();

        var defaultTables = {
            conv: 'u_geo_va_conversation',
            msg: 'u_geo_va_message'
        };
        this.tables = global.JSUtil.notNil(tables) ? tables : defaultTables;

        if (!this.tables.conv || !this.tables.msg) {
            gs.error("GeoVAConversationService: Initialized with invalid table configuration.", "GeoVA");
        }
    },

    /**
     * Retrieves a list of conversations for the current user.
     *
     * @param {number} [limit=20] - The maximum number of conversations to retrieve.
     * @returns {object} An object containing the list of conversations and a flag indicating if the max limit has been reached.
     */
    getConversations: function (limit) {
        limit = parseInt(limit, 10) || 20;
        var conversations = [];
        var activeCount = 0;

        var convGr = new GlideRecord(this.tables.conv);
        convGr.addQuery('u_user', this.userID);
        convGr.orderByDesc('u_last_activity_at');
        convGr.setLimit(limit);
        convGr.query();

        while (convGr.next()) {
            var isActive = convGr.getValue('u_active') === '1';
            if (isActive) activeCount++;

            conversations.push({
                id: convGr.getValue('sys_id'),
                number: convGr.getValue('u_number'),
                name: convGr.getValue('u_name') || 'Chat',
                avatar: isActive ? (convGr.getValue('u_name') || '??').substring(0, 2).toUpperCase() : 'CL',
                lastMessage: convGr.getValue('u_last_message') || '',
                unread: 0,
                isActive: isActive,
                state: convGr.getValue('u_state')
            });
        }

        return {
            conversations: conversations,
            max_conversations_reached: activeCount >= this.config.max_active_chats
        };
    },

    /**
     * Retrieves all messages for a given conversation.
     *
     * @param {string} conversationSysId - The Sys ID of the conversation.
     * @returns {Array} An array of message objects.
     */
    getMessages: function (conversationSysId) {
        var messages = [];
        if (!conversationSysId) {
            gs.log("GeoVAConversationService.getMessages called without a conversationSysId.", "GeoVA");
            return messages;
        }

        var msgGr = new GlideRecord(this.tables.msg);
        msgGr.addQuery('u_conversation', conversationSysId);
        msgGr.orderBy('sys_created_on');
        msgGr.query();

        while (msgGr.next()) {
            messages.push({
                type: msgGr.getValue('u_sender_type'),
                text: msgGr.getValue('u_payload'),
                timestamp: this._formatTime(msgGr.getValue('sys_created_on'))
            });
        }

        return messages;
    },

    /**
     * Creates a new conversation for the user.
     *
     * @param {string} [name] - The initial name for the conversation.
     * @returns {object} An object containing the new conversation's Sys ID and number, or an error if the limit is reached.
     */
    createConversation: function (name) {
        var activeCount = this._countConversations(true);
        if (activeCount >= this.config.max_active_chats) {
            return {
                limit_error: 'active_limit',
                max_conversations_reached: true
            };
        }

        var closedCount = this._countConversations(false);
        if (closedCount >= this.config.max_closed_chats) {
            return {
                limit_error: 'closed_limit'
            };
        }

        var convGr = new GlideRecord(this.tables.conv);
        convGr.initialize();
        convGr.setValue('u_user', this.userID);
        convGr.setValue('u_name', name || 'New Chat');
        convGr.setValue('u_state', 'open');
        convGr.setValue('u_active', true);
        convGr.setValue('u_last_message', 'Initialized.');
        convGr.setValue('u_last_activity_at', new GlideDateTime());
        var sysId = convGr.insert();

        this._insertAgentMessage(sysId, JSON.stringify({
            data: {
                action: 'SHOW_TEXT',
                text: 'Hello! I am your AI Assistant.'
            },
            status: 'completed'
        }));

        return {
            new_sys_id: sysId,
            new_number: convGr.getValue('u_number')
        };
    },

    /**
     * Disables a conversation, setting it to inactive.
     *
     * @param {string} conversationSysId - The Sys ID of the conversation to disable.
     * @returns {boolean} True if successful, false otherwise.
     */
    disableConversation: function (conversationSysId) {
        if (!conversationSysId) {
            gs.log("GeoVAConversationService.disableConversation called without a conversationSysId.", "GeoVA");
            return false;
        }

        var convGr = new GlideRecord(this.tables.conv);
        if (convGr.get(conversationSysId) && (convGr.getValue('u_user') === this.userID || gs.hasRole('admin'))) {
            convGr.setValue('u_active', false);
            convGr.setValue('u_state', 'closed');
            convGr.setValue('u_close_reason', 'user_disabled');
            convGr.update();
            return true;
        }

        return false;
    },

    /**
     * Renames an active conversation.
     *
     * @param {string} conversationSysId - The Sys ID of the conversation.
     * @param {string} name - The new name for the conversation.
     * @returns {boolean} True if successful, false otherwise.
     */
    renameConversation: function (conversationSysId, name) {
        if (!conversationSysId || !name) return false;

        var convGr = new GlideRecord(this.tables.conv);
        if (convGr.get(conversationSysId) && convGr.getValue('u_active') === '1') {
            convGr.setValue('u_name', name);
            convGr.update();
            return true;
        }

        return false;
    },

    /**
     * Handles sending a user's message and retrieving a reply from the AI gateway.
     *
     * @param {string} conversationSysId - The Sys ID of the conversation.
     * @param {string} messageText - The text of the user's message.
     * @param {string} [forceTool] - Optional tool to force the AI to use.
     * @param {object} [forceArguments] - Optional arguments for the forced tool.
     * @returns {object} An object containing the bot's reply and updated conversation details.
     */
    sendMessageWithReply: function (conversationSysId, messageText, forceTool, forceArguments) {
        var result = {
            bot_message_content: null,
            updated_conversation_name: null,
            conversation_number: null
        };

        if (!conversationSysId || !messageText || !messageText.trim()) {
            result.bot_message_content = JSON.stringify({
                data: { action: 'ERROR', text: 'Invalid request' },
                status: 'completed'
            });
            return result;
        }

        var convGr = new GlideRecord(this.tables.conv);
        if (!convGr.get(conversationSysId)) {
            result.bot_message_content = JSON.stringify({
                data: { action: 'ERROR', text: 'Conversation not found' },
                status: 'completed'
            });
            return result;
        }

        if (convGr.getValue('u_user') !== this.userID && !gs.hasRole('admin')) {
            result.bot_message_content = JSON.stringify({
                data: { action: 'ERROR', text: 'Access denied' },
                status: 'completed'
            });
            return result;
        }

        if (convGr.getValue('u_active') === 'false') {
            result.bot_message_content = JSON.stringify({
                data: { action: 'ERROR', text: 'Session closed' },
                status: 'completed'
            });
            return result;
        }

        this._insertUserMessage(conversationSysId, messageText);
        this._maybeAutoRenameConversation(convGr, messageText);

        var botReply = this._callAIGateway(conversationSysId, messageText, forceTool, forceArguments);
        this._insertAgentMessage(conversationSysId, botReply);

        result.bot_message_content = botReply;

        var currentConv = new GlideRecord(this.tables.conv);
        if (currentConv.get(conversationSysId)) {
            result.updated_conversation_name = currentConv.getValue('u_name');
            result.conversation_number = currentConv.getValue('u_number');
        }

        return result;
    },

    /**
     * Handles submitting an approval decision to the AI Gateway.
     *
     * @param {string} conversationSysId - The Sys ID of the conversation.
     * @param {string} decisionType - The decision ('approve', 'reject', etc.).
     * @returns {object} An object containing the bot's reply.
     */
    submitApproval: function (conversationSysId, decisionType) {
        var result = {
            bot_message_content: null,
            updated_conversation_name: null,
            conversation_number: null
        };

        if (!conversationSysId || !decisionType) {
            result.bot_message_content = JSON.stringify({
                data: { action: 'ERROR', text: 'Invalid approval request' },
                status: 'completed'
            });
            return result;
        }

        var convGr = new GlideRecord(this.tables.conv);
        if (!convGr.get(conversationSysId) || (convGr.getValue('u_user') !== this.userID && !gs.hasRole('admin'))) {
            result.bot_message_content = JSON.stringify({
                data: { action: 'ERROR', text: 'Access denied or not found' },
                status: 'completed'
            });
            return result;
        }

        var displayDecision = decisionType === 'approve' ? 'Decision: Approved' : 'Decision: Rejected';
        this._insertUserMessage(conversationSysId, displayDecision);

        var payload = {
            decisions: [{ type: decisionType }],
            metadata: {
                session_id: conversationSysId,
                user_id: this.userID
            }
        };

        var botReply = this._executeRestRequest('approve', payload);

        this._insertAgentMessage(conversationSysId, botReply);
        result.bot_message_content = botReply;

        return result;
    },

    /**
     * Fetches all initial data required for the widget to load.
     *
     * @param {string} [activeSysId] - The Sys ID of the conversation to make active.
     * @returns {object} An object containing conversations, messages for the active chat, and other UI state.
     */
    fetchInitialData: function (activeSysId) {
        var sidebar = this.getConversations();
        var selectedId = activeSysId || (sidebar.conversations.length ? sidebar.conversations[0].id : null);

        if (!selectedId && sidebar.conversations.length === 0) {
            var welcome = this._createWelcomeConversation();
            sidebar.conversations.push(welcome.conversation);
            selectedId = welcome.id;
        }

        return {
            conversations: sidebar.conversations,
            messages: selectedId ? this.getMessages(selectedId) : [],
            active_sys_id: selectedId,
            max_conversations_reached: sidebar.max_conversations_reached
        };
    },

    _countConversations: function (active) {
        var aggr = new GlideAggregate(this.tables.conv);
        aggr.addAggregate('COUNT');
        aggr.addQuery('u_user', this.userID);
        aggr.addQuery('u_active', active ? true : false);
        aggr.query();
        return aggr.next() ? parseInt(aggr.getAggregate('COUNT'), 10) || 0 : 0;
    },

    _insertUserMessage: function (conversationSysId, text) {
        this._insertMessage(conversationSysId, 'user', text);
    },

    _insertAgentMessage: function (conversationSysId, payload) {
        this._insertMessage(conversationSysId, 'agent', payload);
    },

    _insertMessage: function (conversationSysId, senderType, payload) {
        var msgGr = new GlideRecord(this.tables.msg);
        msgGr.initialize();
        msgGr.setValue('u_conversation', conversationSysId);
        msgGr.setValue('u_sender_type', senderType);
        msgGr.setValue('u_payload', payload);
        msgGr.insert();
    },

    _maybeAutoRenameConversation: function (convGr, messageText) {
        var currentName = (convGr.getValue('u_name') || '').trim();
        var defaultNames = ['New Chat', 'Chat'];
        if (defaultNames.indexOf(currentName) === -1) return;

        var title = messageText.replace(/<[^>]*>?/gm, '').trim().substring(0, 60);
        if (!title) return;

        convGr.setValue('u_name', title);
        convGr.update();
    },

    _callAIGateway: function (convSysId, userText, forceTool, forceArguments) {
        var payload = {
            instruction: userText,
            data: {},
            metadata: {
                session_id: convSysId,
                user_id: this.userID,
                include_history: this.config.include_history,
                history_limit: this.config.history_limit
            }
        };
        
        if (forceTool) {
            payload.metadata.force_tool = forceTool;
        }
        if (forceArguments) {
            payload.metadata.force_arguments = forceArguments;
        }

        return this._executeRestRequest('send_user_prompt', payload);
    },

    _executeRestRequest: function(restMethod, payload) {
        var LOG_KEY = 'GeoVA-API-LOG';
        try {
            gs.log(LOG_KEY + ' | Sending API request with method: ' + restMethod, 'GeoVA');
            gs.log(LOG_KEY + ' | Request Body: ' + JSON.stringify(payload), 'GeoVA');

            var r = new sn_ws.RESTMessageV2('ai_agents_gateway', restMethod);
            r.setStringParameterNoEscape('base_url', this.config.gateway_url);
            r.setRequestBody(JSON.stringify(payload));
            r.setHttpTimeout(this.config.gateway_timeout);

            if (this.config.mid_server) {
                r.setMIDServer(this.config.mid_server);
            }

            var accessToken = this.authService.getAccessToken();
            if (accessToken) {
                r.setRequestHeader('Authorization', 'Bearer ' + accessToken);
            }
            r.setRequestHeader('Accept', 'application/json');

            var response = r.execute();
            var status = response.getStatusCode();
            var body = response.getBody() || '';

            gs.log(LOG_KEY + ' | API Response Status: ' + status, 'GeoVA');
            gs.log(LOG_KEY + ' | API Response Body: ' + body, 'GeoVA');

            if (status < 200 || status >= 300) {
                gs.error(LOG_KEY + ' | HTTP status ' + status + '. Body: ' + body, 'GeoVA');
                return JSON.stringify({
                    data: { action: 'ERROR', text: 'AI gateway returned HTTP status ' + status + '.' },
                    status: 'completed'
                });
            }

            if (!this._parseJsonSafe(body)) {
                gs.error(LOG_KEY + ' | Invalid JSON response: ' + body, 'GeoVA');
                return JSON.stringify({
                    data: { action: 'ERROR', text: 'Invalid AI response' },
                    status: 'completed'
                });
            }

            return body;
        } catch (ex) {
            gs.error(LOG_KEY + ' | _executeRestRequest failed: ' + ex.message, 'GeoVA');
            return JSON.stringify({
                data: { action: 'ERROR', text: 'Internal Error: ' + ex.message },
                status: 'completed'
            });
        }
    },

    _parseJsonSafe: function (str) {
        if (!str || typeof str !== 'string') return null;
        var trimmed = str.trim();
        if (!trimmed) return null;

        try {
            return JSON.parse(trimmed);
        } catch (e) {
            var first = trimmed.indexOf('{');
            var last = trimmed.lastIndexOf('}');
            if (first > -1 && last > first) {
                try {
                    return JSON.parse(trimmed.substring(first, last + 1));
                } catch (e2) {
                    gs.error("GeoVAConversationService._parseJsonSafe failed secondary parse attempt.", "GeoVA");
                    return null;
                }
            }
            return null;
        }
    },

    _formatTime: function (sysCreatedOn) {
        if (!sysCreatedOn) return '';
        var gdt = new GlideDateTime(sysCreatedOn);
        return gdt.getLocalTime().getByFormat('hh:mm a');
    },

    _createWelcomeConversation: function () {
        var first = new GlideRecord(this.tables.conv);
        first.initialize();
        first.setValue('u_user', this.userID);
        first.setValue('u_name', 'Welcome');
        first.setValue('u_state', 'open');
        first.setValue('u_active', true);
        first.setValue('u_last_message', 'Hello!');
        first.setValue('u_last_activity_at', new GlideDateTime());
        var id = first.insert();

        this._insertAgentMessage(id, JSON.stringify({
            data: {
                action: 'SHOW_TEXT',
                text: 'Hello! I am your AI Assistant.'
            },
            status: 'completed'
        }));

        return {
            id: id,
            conversation: {
                id: id,
                number: first.getValue('u_number'),
                name: 'Welcome',
                avatar: 'WE',
                lastMessage: 'Hello!',
                unread: 0,
                isActive: true,
                state: 'open'
            }
        };
    },

    type: 'GeoVAConversationService'
};
