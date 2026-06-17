# Gateway Contract: Live AI Agent Payloads

This file documents the actual, real-world JSON payloads returned by the live AI Gateway endpoint. Use this as the source of truth for handling incoming REST responses before parsing them into the widget.

## 1. Live Greeting Response (The SHOW_KB Variant)
**Note for AI Agent:** The gateway does not send `SHOW_TEXT`. For standard text greetings, it sends `SHOW_KB` with `kb_suggestions` set to `null`.
```json
{
  "status": "completed",
  "message": "Request processed successfully",
  "error": null,
  "data": {
    "action": "SHOW_KB",
    "text": "Hi there! How can I assist you today with your ServiceNow needs?",
    "kb_suggestions": null
  }
}
2. Live Knowledge Base Response
JSON
{
  "status": "completed",
  "message": "Request processed successfully",
  "data": {
    "action": "SHOW_KB",
    "text": "I found these relevant articles:",
    "kb_suggestions": [
      {
        "number": "KB000001",
        "title": "CRM Salesforce Connection Issues",
        "url": "[https://example.sharepoint.com/doc_path](https://example.sharepoint.com/doc_path)",
        "summary": "Troubleshooting description text."
      }
    ]
  }
}
3. Live Confirmation Response (The Interrupted Status)
Note for AI Agent: The status shifts to "interrupted". The ticket details are deeply nested inside a draft object.

JSON
{
  "status": "interrupted",
  "message": "Human approval required",
  "data": {
    "action": "ASK_CONFIRM",
    "text": "Here's the draft. Shall I create the incident?",
    "confirm_INC_Creation": {
      "intent": "create_incident",
      "draft": {
        "short_description": "Create incident for ServiceNow user",
        "description": "Detailed automated text block...",
        "assignment_group": "GLOBAL-L2-BI"
      }
    }
  }
}
4. Live Ticket Success Response
Note for AI Agent: The gateway does not provide a structured incident object or a URL string. The incident number is embedded directly into the flat text string.

JSON
{
  "status": "completed",
  "message": "Request processed successfully",
  "data": {
    "action": "INCIDENT_CREATED",
    "text": "Incident INC0123456 has been created successfully."
  }
}