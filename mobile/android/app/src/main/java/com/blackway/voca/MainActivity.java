package com.blackway.voca;

import android.os.Bundle;
import androidx.webkit.WebSettingsCompat;
import androidx.webkit.WebViewFeature;
import com.blackway.voca.plugins.AndroidAudioRoutePlugin;
import com.blackway.voca.plugins.AndroidNotificationsPlugin;
import com.blackway.voca.plugins.AndroidVideoRecorderPlugin;
import com.getcapacitor.BridgeActivity;
import com.getcapacitor.Logger;

public class MainActivity extends BridgeActivity {

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        registerPlugin(AndroidAudioRoutePlugin.class);
        registerPlugin(AndroidNotificationsPlugin.class);
        registerPlugin(AndroidVideoRecorderPlugin.class);
        super.onCreate(savedInstanceState);

        if (getBridge() == null || getBridge().getWebView() == null) {
            return;
        }

        if (WebViewFeature.isFeatureSupported(WebViewFeature.WEB_AUTHENTICATION)) {
            WebSettingsCompat.setWebAuthenticationSupport(
                getBridge().getWebView().getSettings(),
                WebSettingsCompat.WEB_AUTHENTICATION_SUPPORT_FOR_APP
            );
            Logger.info("Enabled WebAuthn support for the app WebView");
        } else {
            Logger.warn("This WebView does not expose Android WebAuthn support");
        }
    }
}
