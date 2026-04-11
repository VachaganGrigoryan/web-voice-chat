package com.blackway.voca.plugins;

import android.content.Context;
import android.media.AudioAttributes;
import android.media.Ringtone;
import android.media.RingtoneManager;
import android.net.Uri;
import android.os.Build;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

@CapacitorPlugin(name = "AndroidCallRingtone")
public class AndroidCallRingtonePlugin extends Plugin {

    private Ringtone activeRingtone;

    @PluginMethod
    public void playDefaultRingtone(PluginCall call) {
        Context context = getContext();
        if (context == null) {
            call.reject("Application context is unavailable.");
            return;
        }

        Uri ringtoneUri = RingtoneManager.getDefaultUri(RingtoneManager.TYPE_RINGTONE);
        if (ringtoneUri == null) {
            ringtoneUri = RingtoneManager.getActualDefaultRingtoneUri(
                context,
                RingtoneManager.TYPE_RINGTONE
            );
        }

        if (ringtoneUri == null) {
            call.reject("No default ringtone is configured on this device.");
            return;
        }

        stopActiveRingtone();

        Ringtone ringtone = RingtoneManager.getRingtone(context.getApplicationContext(), ringtoneUri);
        if (ringtone == null) {
            call.reject("Failed to load the default ringtone.");
            return;
        }

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.LOLLIPOP) {
            ringtone.setAudioAttributes(
                new AudioAttributes.Builder()
                    .setUsage(AudioAttributes.USAGE_NOTIFICATION_RINGTONE)
                    .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
                    .build()
            );
        }

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) {
            ringtone.setLooping(true);
        }

        ringtone.play();
        activeRingtone = ringtone;
        call.resolve();
    }

    @PluginMethod
    public void stop(PluginCall call) {
        stopActiveRingtone();
        call.resolve();
    }

    private void stopActiveRingtone() {
        if (activeRingtone == null) {
            return;
        }

        if (activeRingtone.isPlaying()) {
            activeRingtone.stop();
        }

        activeRingtone = null;
    }
}
