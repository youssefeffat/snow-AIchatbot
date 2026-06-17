# Solution Design: GeoVA AI Chatbot Integration

## 1. Overview
The GeoVA AI Chatbot is a ServiceNow Service Portal widget that connects users to an external AI Agent. It provides a conversational interface capable of displaying text, Knowledge Base articles, Service Catalog items, and interactive confirmation prompts.

## 2. Component Architecture
The solution uses a standard ServiceNow Model-View-Controller (MVC) pattern, backed by a Script Include for API communication.

* **View (`template.html`):** Built with AngularJS 1.x. It renders different chat cards (chat bubbles, KB links, confirmation buttons) by looking at the `message.payload.action` variable.
* **Controller (`client_script.js`):** Manages user interactions (clicks, typing). It intercepts user input, updates the UI immediately so it feels fast, and uses `c.server.get()` to send the data to the server.
* **Router (`server_script.js`):** Acts as a traffic cop. It reads the action from the Client Script (e.g., `send_message_with_reply`) and triggers the corresponding function in the Script Include. It also holds the UI translations (i18n).
* **Backend Engine (`GeoVAConversationService` Script Include):** Handles all heavy lifting. It saves message history to custom tables (`u_geo_va_conversation`, `u_geo_va_message`) and uses `sn_ws.RESTMessageV2` to talk to the AI Gateway.

## 3. The Data Lifecycle (Message Flow)
When a user types a message and clicks Send, the following sequence occurs:
1.  **Client:** Pushes the text to the chat window and sends an AJAX request to the Server Script.
2.  **Server Script:** Routes the text to the `GeoVAConversationService`.
3.  **Script Include:** Packages the text and session details into a JSON payload and posts it to the AI Gateway.
4.  **AI Gateway:** Processes the text and returns a JSON response wrapped in a standard envelope.
5.  **Client:** Receives the response, parses the inner `data` object, and renders the specific UI component (like a text bubble or an incident link).

To make your SOLUTION.md file perfectly optimized for Antigravity, Section 4 needs a complete overhaul. Right now, Section 4 describes the fantasy version of the API, which will cause your coding agent to write broken code. It needs to describe the reality of what the live AI gateway actually sends.

Here is exactly what must be modified, followed by the corrected markdown you can copy and paste to replace Section 4.

The 3 Critical Modifications:
The Greeting Fix: We need to clarify that standard text greetings come through as SHOW_KB with kb_suggestions: null, not as SHOW_TEXT.

The Confirmation Fix: We must update the ASK_CONFIRM block to show that the status changes to "interrupted" and the ticket data is nested inside a draft object.

The Ticket Creation Fix: We need to remove the structured incident object from INCIDENT_CREATED and show that the incident number is just returned as a flat string in the text field.

The Corrected Markdown (Replace everything from Section 4 down)
Markdown
## 4. AI Gateway API Contract (Live Reality)
This defines the exact data structures passed between ServiceNow and the AI Agent based on live endpoint testing. **CRITICAL: The widget must parse these exact structures.**

### A. Outbound Request Payload (ServiceNow -> AI)
Sent via POST to `/portal/agent`.
```json
{
  "instruction": "I cannot access the VPN",
  "data": {},
  "metadata": {
    "session_id": "conversation-sys-id-123",
    "user_id": "user-sys-id-456",
    "include_history": true,
    "history_limit": 10
  }
}
B. Inbound Response Payload (AI -> ServiceNow)
The widget expects the AI to wrap its answer in a standard envelope. The widget reads the data.action field to know what to display. Note that the status can be "completed" or "interrupted".

Standard Wrapper Example:

JSON
{
  "status": "completed",
  "message": "Request processed successfully",
  "data": {
    "action": "SHOW_KB",
    "text": "Let me help you with that.",
    "kb_suggestions": null
  }
}
C. Supported Action Variations (Inside the data object)
The AI Agent returns these specific structures. The ServiceNow widget must handle these exact paths.

1. Standard Greeting / Text (Handled via SHOW_KB)
Note: The gateway does not send SHOW_TEXT for standard greetings.

JSON
{
  "action": "SHOW_KB",
  "text": "Hi there! How can I assist you today?",
  "kb_suggestions": null
}
2. Knowledge Base Suggestions (SHOW_KB)

JSON
{
  "action": "SHOW_KB",
  "text": "I found these relevant articles:",
  "kb_suggestions": [
    {
      "number": "KB000001",
      "title": "CRM Connection Issues",
      "url": "[https://example.com/doc](https://example.com/doc)",
      "summary": "Troubleshooting description text."
    }
  ]
}
3. Service Catalog (SHOW_CATALOG)

JSON
{
  "action": "SHOW_CATALOG",
  "catalog_items": [
    {
      "name": "Laptop Request",
      "url": "[https://example.com/catalog/laptop](https://example.com/catalog/laptop)"
    }
  ]
}
4. Confirmation Dialog (ASK_CONFIRM)
Note: The root envelope status for this action will be "interrupted". The ticket details are nested inside the draft object.

JSON
{
  "action": "ASK_CONFIRM",
  "text": "Here's the draft. Shall I create the incident?",
  "confirm_INC_Creation": {
    "intent": "create_incident",
    "draft": {
      "short_description": "Create incident for ServiceNow user",
      "description": "Creating an incident in ServiceNow...",
      "assignment_group": "GLOBAL-L2-BI"
    }
  }
}
5. Ticket Success (INCIDENT_CREATED)
Note: There is no structured incident object or URL. The data is a flat string.

JSON
{
  "action": "INCIDENT_CREATED",
  "text": "Incident INC0123456 has been created successfully."
}
6. Error Handling (ERROR)

JSON
{
  "action": "ERROR",
  "text": "System error description."
}