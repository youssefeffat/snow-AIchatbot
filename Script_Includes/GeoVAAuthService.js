var GeoVAAuthService = Class.create();
GeoVAAuthService.prototype = {

    initialize: function() {
        this.config = {
            tokenUrl: gs.getProperty('global.geova.auth.token_url', 'https://login.microsoftonline.com/YOUR_TENANT/oauth2/v2.0/token'),
            clientId: gs.getProperty('global.geova.auth.client_id', 'REPLACE_ME'),
            jwtProviderSysId: gs.getProperty('global.geova.auth.jwt_provider_sys_id', 'e1b82d301b518b5080570ed1604bcb98'),
            iss: gs.getProperty('global.geova.auth.iss', '61a6a030-51ee-4cf4-a681-2ac8c5b9864c'),
            scope: gs.getProperty('global.geova.auth.scope', 'api://6ca7c865-17d8-442c-84f2-1f6b75411e6b/.default')
        };
    },

    /**
     * Generates a new JWT and retrieves the OAuth access token from the Identity Provider.
     * Implements session-level caching to prevent redundant token requests.
     * 
     * @returns {string|null} The Access Token, or null if retrieval fails.
     */
    getAccessToken: function() {
        var session = gs.getSession();
        var cachedToken = session.getClientData('geova_access_token');
        var tokenExpiry = session.getClientData('geova_access_token_expiry');
        
        var nowMs = new Date().getTime();
        
        // Return cached token if it exists and hasn't expired
        if (cachedToken && tokenExpiry && nowMs < parseInt(tokenExpiry, 10)) {
            return cachedToken;
        }

        var jwtAPI = new sn_auth.GlideJWTAPI();
        var headerJSON = { typ: "JWT", alg: "RSA256" };
        var header = JSON.stringify(headerJSON);
        
        var gdt = new GlideDateTime();
        gdt.addSeconds(6000);
        
        var payloadJSON = {
            "iat": gs.now(),
            "iss": this.config.iss,
            "exp": gdt,
            "grant_type": "urn:ietf:params:oauth:grant-type:jwt-bearer",
            "assertion": "userAccessToken",
            "requested_token_use": "on_behalf_of"
        };
        var payload = JSON.stringify(payloadJSON);
        var jwt = jwtAPI.generateJWT(this.config.jwtProviderSysId, header, payload);
        
        var tokenReq = new sn_ws.RESTMessageV2();
        tokenReq.setHttpMethod('POST');
        tokenReq.setEndpoint(this.config.tokenUrl);
        tokenReq.setRequestHeader('Content-Type', 'application/x-www-form-urlencoded');

        var bodyParams = 'grant_type=client_credentials' +
            '&client_id=' + encodeURIComponent(this.config.clientId) +
            '&scope=' + encodeURIComponent(this.config.scope) +
            '&client_assertion_type=' + encodeURIComponent('urn:ietf:params:oauth:client-assertion-type:jwt-bearer') +
            '&client_assertion=' + encodeURIComponent(jwt);

        tokenReq.setRequestBody(bodyParams);

        var tokenResp = tokenReq.execute();
        var status = tokenResp.getStatusCode();
        var tokenBody = tokenResp.getBody();
        
        if (status < 200 || status >= 300) {
            gs.error('GeoVAAuthService: Failed to retrieve access token. Status: ' + status + ', Body: ' + tokenBody, 'GeoVA');
            return null;
        }

        try {
            var parsedResp = JSON.parse(tokenBody);
            var accessToken = parsedResp.access_token;
            
            // Usually Azure AD returns expires_in in seconds. Default to 3599 if missing.
            var expiresInSeconds = parseInt(parsedResp.expires_in, 10) || 3599;
            
            // Cache the token, expiring it 1 minute before actual expiration for safety margin
            var expiryTimeMs = nowMs + ((expiresInSeconds - 60) * 1000);
            session.putClientData('geova_access_token', accessToken);
            session.putClientData('geova_access_token_expiry', expiryTimeMs.toString());

            return accessToken;
        } catch (ex) {
            gs.error('GeoVAAuthService: Failed to parse token response. Error: ' + ex.message, 'GeoVA');
            return null;
        }
    },

    type: 'GeoVAAuthService'
};
