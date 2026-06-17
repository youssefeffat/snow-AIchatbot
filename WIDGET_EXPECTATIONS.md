Markdown
# Widget Contract: Existing UI Input Expectations

This file documents the exact JSON schemas the ServiceNow Service Portal Widget UI elements are designed to read. Use this to understand how data must be formatted before it hits the AngularJS client template.

## 1. Standard Chat UI (SHOW_TEXT)
The widget expects standard conversational text to arrive under a specific action flag so it can render a normal chat bubble.
```json
{
  "action": "SHOW_TEXT",
  "text": "The message text goes here."
}
2. Knowledge Base UI (SHOW_KB)
The widget template loops through an array of suggestions to render a list of clickable KB articles.

JSON
{
  "action": "SHOW_KB",
  "kb_suggestions": [
    {
      "number": "KB001234",
      "title": "Article Title",
      "summary": "Brief description of the article content.",
      "url": "[https://example.com/kb_article_link](https://example.com/kb_article_link)"
    }
  ]
}
3. Confirmation Dialog UI (ASK_CONFIRM)
The widget renders "Approve" and "Reject" buttons based on this structure. It reads values directly from the root of the object.

JSON
{
  "action": "ASK_CONFIRM",
  "confirm_INC_Creation": {
    "short_description": "The ticket summary",
    "description": "Detailed explanation for the ticket."
  }
}
4. Ticket Success UI (INCIDENT_CREATED)
The widget expects a dedicated incident object so it can display a clean, direct link to the newly generated ticket.

JSON
{
  "action": "INCIDENT_CREATED",
  "text": "Success message.",
  "incident": {
    "number": "INC0012345",
    "url": "[https://instance.service-now.com/nav_to.do?uri=incident.do?sys_id=123](https://instance.service-now.com/nav_to.do?uri=incident.do?sys_id=123)"
  }
}