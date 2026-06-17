(function(input, data) {

    // 1. Define Configuration for the Service
    // This allows you to easily change settings directly from the widget if needed,
    // without modifying the Script Include. Pass `null` to use the defaults defined in the service.
    var serviceConfig = {
        max_active_chats: parseInt(gs.getProperty('global.max_active_chats', '3'), 10),
        max_closed_chats: parseInt(gs.getProperty('global.max_closed_chats', '7'), 10),
		gateway_url: gs.getProperty('global.gateway_url', 'https://dev-agent-snow-corp-ais-dev.apps.ic2dr6fr.westeurope.aroapp.io/api/v1/chat'),
        gateway_timeout: parseInt(gs.getProperty('global.gateway.timeout', '20000'), 10)
    };

    var tableConfig = {
        conv: 'u_geo_va_conversation',
        msg: 'u_geo_va_message'
    };

    // 2. Initialize the Conversation Service
    // We pass the current user's ID, and the configurations.
    var convService = new global.GeoVAConversationService(gs.getUserID(), serviceConfig, tableConfig);

    // 3. Handle AJAX Actions
    if (input && input.action) {
        var response = {};
        // Route the action to the correct service method
        switch (input.action) {
            case 'send_message_with_reply':
                response = convService.sendMessageWithReply(input.conversation_id, input.message_text, input.force_tool, input.force_arguments);
                break;
            case 'create_new_conversation':
                response = convService.createConversation(input.name);
                break;
            case 'disable_conversation':
                response = {
                    success: convService.disableConversation(input.sys_id)
                };
                break;
            case 'fetch_messages':
                response = {
                    messages: convService.getMessages(input.active_sys_id)
                };
                break;
            case 'rename_conversation':
                response = {
                    success: convService.renameConversation(input.sys_id, input.name)
                };
                break;
        }
        // Copy all properties from the service response to the widget's data object
        for (var key in response) {
            if (response.hasOwnProperty(key)) {
                data[key] = response[key];
            }
        }
        return;
    }

    // 4. Handle Initial Page Load
    var initialData = convService.fetchInitialData(input.active_sys_id);
    data.conversations = initialData.conversations;
    data.messages = initialData.messages;
    data.active_sys_id = initialData.active_sys_id;
    data.max_conversations_reached = initialData.max_conversations_reached;


    // 5. Add any other necessary UI-only data (i18n messages, etc.)
    // This part remains specific to the widget's display needs.
    data.i18n = {
        // Labels
        history: gs.getMessage("History"),
        start_new_chat: gs.getMessage("Start New Chat"),
        toggle_sidebar: gs.getMessage("Toggle Sidebar"),
        back: gs.getMessage("Back"),
        new_chat: gs.getMessage("New Chat"),
        contact_options: gs.getMessage("Contact Options"),
        label_session: gs.getMessage("Session"),
        options: gs.getMessage("Options"),
        action_rename: gs.getMessage("Rename"),
        action_close: gs.getMessage("Close"),
        status_archived: gs.getMessage("Archived"),
        status_closed: gs.getMessage("Closed"),
        input_placeholder: gs.getMessage("Type your message..."),
        btn_send: gs.getMessage("Send Message"),
        btn_view_ticket: gs.getMessage("View Ticket"),
        btn_new_chat: gs.getMessage("New Chat"),
        btn_confirm: gs.getMessage("Yes, Create It"),
        btn_cancel: gs.getMessage("No, Cancel"),
        btn_disable: gs.getMessage("Disable"),
        btn_cancel_dialog: gs.getMessage("Cancel"),
        btn_close_menu: gs.getMessage("Close Menu"),

        // Status & Feedback
        status_online: gs.getMessage("AI Assistant • Online"),
        status_session_closed: gs.getMessage("Session Closed"),
        status_thinking: gs.getMessage("Thinking..."),
        status_loading: gs.getMessage("Syncing Neural Network..."),
        status_selection_confirmed: gs.getMessage("Selection confirmed"),
        status_actions_disabled: gs.getMessage("Actions disabled (Session Closed)"),
        label_success: gs.getMessage("Success"),
        label_ticket: gs.getMessage("Ticket"),
        label_summary: gs.getMessage("Issue Summary"),
        label_description: gs.getMessage("Description"),
        card_confirm_title: gs.getMessage("Confirm Details"),
        sender_you: gs.getMessage("You"),

        // Alerts
        banner_limit_reached: gs.getMessage("Max active limit reached."),
        banner_closed_session: gs.getMessage("This session is closed. Start a new chat to continue."),
        alert_limit_reached_client: gs.getMessage("Conversation limit reached. Close a chat to start a new one."),
        alert_max_active_server: gs.getMessage("Max active conversations reached. Please close one."),
        alert_max_closed_server: gs.getMessage("Daily history limit reached. Please wait 24h for system cleanup."),

        // Modals
        modal_support_title: gs.getMessage("Support Options"),
        menu_live_agent: gs.getMessage("Live Agent (Offline)"),
        menu_email: gs.getMessage("Email Support"),
        menu_phone: gs.getMessage("Call Support"),
        menu_full_page: gs.getMessage("Full Page View"),
        dialog_disable_title: gs.getMessage("Disable Session?"),
        dialog_disable_body: gs.getMessage("This conversation will be closed and cannot be reopened."),

        // Defaults
        default_no_active: gs.getMessage("No Active Chats"),
        default_chat_name: gs.getMessage("Chat"),
        default_new_chat_name: gs.getMessage("New Chat"),
        default_welcome_name: gs.getMessage("Welcome"),
        default_init_msg: gs.getMessage("Initialized."),
        default_hello_msg: gs.getMessage("Hello!"),

        // Automation
        auto_welcome_msg: gs.getMessage("Hello! I am your AI Assistant."),
        auto_reply_confirm: gs.getMessage("Yes, please proceed and create the incident."),
        auto_reply_cancel: gs.getMessage("No, cancel.")
    };

    data.config = {
        bot_name: gs.getProperty('global.bot_name', 'GGPT Agent'),
        sidebar_avatar: gs.getProperty('global.logo.sidebar', 'geo_va_logo.png'),
        chat_avatar: gs.getProperty('global.logo.chat', 'geo_va_logo2.png')
    };

})(input, data);