# System Context: GeoVA ServiceNow Portal Widget & AI Integration

You are an AI coding assistant helping build a custom ServiceNow Service Portal Widget. You must strictly adhere to the technical limitations of the ServiceNow platform. Do not assume a modern Node.js or React environment.

## 1. Environment Rules (CRITICAL)

### Server-Side (Script Includes & Widget Server Script)
* **Language:** JavaScript (ES5 / Rhino engine). 
* **Forbidden Syntax:** Do NOT use `const`, `let`, arrow functions (`=>`), `async/await`, `Promise`, classes, or template literals. Use `var` and `function() {}`.
* **APIs:** Use standard ServiceNow Glide APIs (`GlideRecord`, `GlideAggregate`, `GlideDateTime`).
* **Outbound API:** Use `sn_ws.RESTMessageV2()` for HTTP requests. Do NOT use `fetch`, `axios`, or `XMLHttpRequest`.
* **Logging:** Use `gs.info()`, `gs.warn()`, or `gs.error()`. Do NOT use `console.log`.

### Client-Side (Widget Client Script)
* **Framework:** AngularJS 1.x. Do NOT use React, Vue, or modern Angular.
* **Data Binding:** Use `$scope` and the Controller As syntax (`c.data`, `c.server.get()`).
* **DOM Manipulation:** Rely on AngularJS directives (`ng-if`, `ng-repeat`, `ng-class`, `ng-model`). Do NOT use jQuery or `document.getElementById` unless absolutely necessary.

## 2. Integration Architecture
The widget communicates with an external AI Gateway via the `GeoVAConversationService` Script Include.

### What We Send to the AI Gateway
The AI Gateway expects this exact JSON structure for requests:
{
  "instruction": "<User text>",
  "data": {},
  "metadata": {
    "session_id": "<SysID>",
    "user_id": "<SysID>",
    "include_history": true,
    "history_limit": 10,
    "force_tool": null,         // Optional: e.g., "create_incident"
    "force_arguments": null     // Optional: arguments for the tool
  }
}

### What We Receive from the AI Gateway
The AI Gateway wraps its responses in an envelope. The widget client script parses the `data.action` property to render the UI.
{
  "data": {
    "action": "SHOW_TEXT",      // Variants: SHOW_KB, SHOW_CATALOG, ASK_CONFIRM, INCIDENT_CREATED, ERROR
    "text": "Hello!"
  },
  "message": "Request processed successfully",
  "metadata": { ... },
  "status": "completed"
}

## 3. Workflow Instructions
When asked to modify the code:
1.  Identify if the change belongs in the Client Script (UI/interactions), HTML Template (View), Server Script (Routing), or Script Include (Backend Logic).
2.  If adding new UI elements, ensure they match the existing CSS classes and AngularJS patterns.
3.  Always handle JSON parsing safely with a try/catch block.