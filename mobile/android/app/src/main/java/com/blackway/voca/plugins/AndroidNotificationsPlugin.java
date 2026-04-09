package com.blackway.voca.plugins;

import android.Manifest;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.content.pm.PackageManager;
import android.media.AudioAttributes;
import android.media.RingtoneManager;
import android.net.Uri;
import android.os.Build;
import androidx.core.app.NotificationCompat;
import androidx.core.app.NotificationManagerCompat;
import androidx.core.content.ContextCompat;
import com.blackway.voca.R;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.annotation.Permission;
import com.getcapacitor.annotation.PermissionCallback;

@CapacitorPlugin(
    name = "AndroidNotifications",
    permissions = {
        @Permission(strings = { Manifest.permission.POST_NOTIFICATIONS }, alias = AndroidNotificationsPlugin.NOTIFICATIONS),
    }
)
public class AndroidNotificationsPlugin extends Plugin {

    static final String NOTIFICATIONS = "notifications";
    private static final String CHANNEL_MESSAGES_DEFAULT = "messages_default";
    private static final String CHANNEL_MESSAGES_SILENT = "messages_silent";
    private static final String PREFERENCES_NAME = "android_notifications";
    private static final String KEY_NOTIFICATIONS_PERMISSION_REQUESTED = "notifications_permission_requested";
    private static final String PERMISSION_DENIED = "denied";
    private static final String PERMISSION_GRANTED = "granted";
    private static final String PERMISSION_PROMPT = "prompt";

    @PluginMethod
    public void checkPermissions(PluginCall call) {
        ensureNotificationChannels();
        call.resolve(buildPermissionsResult());
    }

    @PluginMethod
    public void requestPermissions(PluginCall call) {
        ensureNotificationChannels();

        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.TIRAMISU) {
            call.resolve(buildPermissionsResult());
            return;
        }

        markPermissionRequested();
        requestPermissionForAlias(NOTIFICATIONS, call, "notificationsPermissionCallback");
    }

    @PermissionCallback
    private void notificationsPermissionCallback(PluginCall call) {
        call.resolve(buildPermissionsResult());
    }

    @PluginMethod
    public void notify(PluginCall call) {
        Context context = getContext();
        if (context == null) {
            call.reject("Application context is unavailable.");
            return;
        }

        ensureNotificationChannels();

        JSObject response = new JSObject();
        if (!areNotificationsEnabled(context)) {
            response.put("presented", false);
            response.put("reason", "permission_denied");
            call.resolve(response);
            return;
        }

        String title = call.getString("title", context.getString(R.string.app_name));
        String message = call.getString("message", "");
        boolean withSound = call.getBoolean("withSound", true);
        String channelId = withSound ? CHANNEL_MESSAGES_DEFAULT : CHANNEL_MESSAGES_SILENT;

        NotificationCompat.Builder builder = new NotificationCompat.Builder(context, channelId)
            .setSmallIcon(R.mipmap.ic_launcher_foreground)
            .setContentTitle(title)
            .setContentText(message)
            .setStyle(new NotificationCompat.BigTextStyle().bigText(message))
            .setAutoCancel(true)
            .setPriority(NotificationCompat.PRIORITY_HIGH)
            .setCategory(NotificationCompat.CATEGORY_MESSAGE)
            .setVisibility(NotificationCompat.VISIBILITY_PRIVATE)
            .setOnlyAlertOnce(false)
            .setSilent(!withSound);

        PendingIntent contentIntent = buildLaunchPendingIntent(context);
        if (contentIntent != null) {
            builder.setContentIntent(contentIntent);
        }

        if (withSound && Build.VERSION.SDK_INT < Build.VERSION_CODES.O) {
            builder.setSound(RingtoneManager.getDefaultUri(RingtoneManager.TYPE_NOTIFICATION));
            builder.setDefaults(NotificationCompat.DEFAULT_VIBRATE | NotificationCompat.DEFAULT_LIGHTS);
        }

        NotificationManagerCompat
            .from(context)
            .notify((int) (System.currentTimeMillis() & 0x0fffffff), builder.build());

        response.put("presented", true);
        call.resolve(response);
    }

    private JSObject buildPermissionsResult() {
        JSObject result = new JSObject();
        result.put("notifications", resolveNotificationPermissionState());
        return result;
    }

    private String resolveNotificationPermissionState() {
        Context context = getContext();
        if (context == null) {
            return PERMISSION_DENIED;
        }

        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.TIRAMISU) {
            return NotificationManagerCompat.from(context).areNotificationsEnabled()
                ? PERMISSION_GRANTED
                : PERMISSION_DENIED;
        }

        if (ContextCompat.checkSelfPermission(context, Manifest.permission.POST_NOTIFICATIONS) ==
            PackageManager.PERMISSION_GRANTED) {
            return NotificationManagerCompat.from(context).areNotificationsEnabled()
                ? PERMISSION_GRANTED
                : PERMISSION_DENIED;
        }

        return wasPermissionRequested() ? PERMISSION_DENIED : PERMISSION_PROMPT;
    }

    private boolean areNotificationsEnabled(Context context) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU &&
            ContextCompat.checkSelfPermission(context, Manifest.permission.POST_NOTIFICATIONS) !=
            PackageManager.PERMISSION_GRANTED) {
            return false;
        }

        return NotificationManagerCompat.from(context).areNotificationsEnabled();
    }

    private PendingIntent buildLaunchPendingIntent(Context context) {
        Intent launchIntent = context
            .getPackageManager()
            .getLaunchIntentForPackage(context.getPackageName());

        if (launchIntent == null) {
            return null;
        }

        launchIntent.addFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP | Intent.FLAG_ACTIVITY_CLEAR_TOP);

        int flags = PendingIntent.FLAG_UPDATE_CURRENT;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            flags |= PendingIntent.FLAG_IMMUTABLE;
        }

        return PendingIntent.getActivity(context, 0, launchIntent, flags);
    }

    private void ensureNotificationChannels() {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) {
            return;
        }

        Context context = getContext();
        if (context == null) {
            return;
        }

        NotificationManager notificationManager =
            (NotificationManager) context.getSystemService(Context.NOTIFICATION_SERVICE);
        if (notificationManager == null) {
            return;
        }

        AudioAttributes audioAttributes = new AudioAttributes.Builder()
            .setUsage(AudioAttributes.USAGE_NOTIFICATION)
            .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
            .build();
        Uri defaultNotificationSound = RingtoneManager.getDefaultUri(RingtoneManager.TYPE_NOTIFICATION);

        if (notificationManager.getNotificationChannel(CHANNEL_MESSAGES_DEFAULT) == null) {
            NotificationChannel audibleChannel = new NotificationChannel(
                CHANNEL_MESSAGES_DEFAULT,
                "Messages",
                NotificationManager.IMPORTANCE_HIGH
            );
            audibleChannel.setDescription("Incoming chat messages with sound");
            audibleChannel.enableLights(true);
            audibleChannel.enableVibration(true);
            audibleChannel.setSound(defaultNotificationSound, audioAttributes);
            notificationManager.createNotificationChannel(audibleChannel);
        }

        if (notificationManager.getNotificationChannel(CHANNEL_MESSAGES_SILENT) == null) {
            NotificationChannel silentChannel = new NotificationChannel(
                CHANNEL_MESSAGES_SILENT,
                "Messages (Silent)",
                NotificationManager.IMPORTANCE_HIGH
            );
            silentChannel.setDescription("Incoming chat messages without sound");
            silentChannel.enableLights(true);
            silentChannel.enableVibration(false);
            silentChannel.setSound(null, null);
            notificationManager.createNotificationChannel(silentChannel);
        }
    }

    private boolean wasPermissionRequested() {
        Context context = getContext();
        if (context == null) {
            return false;
        }

        SharedPreferences preferences = context.getSharedPreferences(PREFERENCES_NAME, Context.MODE_PRIVATE);
        return preferences.getBoolean(KEY_NOTIFICATIONS_PERMISSION_REQUESTED, false);
    }

    private void markPermissionRequested() {
        Context context = getContext();
        if (context == null) {
            return;
        }

        SharedPreferences preferences = context.getSharedPreferences(PREFERENCES_NAME, Context.MODE_PRIVATE);
        preferences.edit().putBoolean(KEY_NOTIFICATIONS_PERMISSION_REQUESTED, true).apply();
    }
}
