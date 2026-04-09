package com.blackway.voca.plugins;

import android.Manifest;
import android.app.Activity;
import android.content.Intent;
import androidx.activity.result.ActivityResult;
import com.blackway.voca.video.NativeVideoRecorderActivity;
import com.getcapacitor.JSObject;
import com.getcapacitor.PermissionState;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.ActivityCallback;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.annotation.Permission;
import com.getcapacitor.annotation.PermissionCallback;

@CapacitorPlugin(
    name = "AndroidVideoRecorder",
    permissions = {
        @Permission(strings = { Manifest.permission.CAMERA }, alias = AndroidVideoRecorderPlugin.CAMERA),
        @Permission(strings = { Manifest.permission.RECORD_AUDIO }, alias = AndroidVideoRecorderPlugin.MICROPHONE),
    }
)
public class AndroidVideoRecorderPlugin extends Plugin {

    static final String CAMERA = "camera";
    static final String MICROPHONE = "microphone";

    @PluginMethod
    public void checkPermissions(PluginCall call) {
        call.resolve(buildPermissionsResult());
    }

    @PluginMethod
    public void requestPermissions(PluginCall call) {
        requestPermissionForAliases(new String[] { CAMERA, MICROPHONE }, call, "permissionsCallback");
    }

    @PermissionCallback
    private void permissionsCallback(PluginCall call) {
        call.resolve(buildPermissionsResult());
    }

    @PluginMethod
    public void record(PluginCall call) {
        if (getPermissionState(CAMERA) != PermissionState.GRANTED ||
            getPermissionState(MICROPHONE) != PermissionState.GRANTED) {
            call.reject("Camera and microphone permissions must be granted before recording.");
            return;
        }

        Intent intent = new Intent(getActivity(), NativeVideoRecorderActivity.class);
        intent.putExtra(
            NativeVideoRecorderActivity.EXTRA_MAX_DURATION_MS,
            call.getLong("maxDurationMs", 90_000L)
        );
        intent.putExtra(
            NativeVideoRecorderActivity.EXTRA_MAX_FILE_SIZE_BYTES,
            call.getLong("maxFileSizeBytes", 10L * 1024L * 1024L)
        );
        intent.putExtra(
            NativeVideoRecorderActivity.EXTRA_PREFERRED_CAMERA,
            call.getString("preferredCamera", "front")
        );
        String replyMode = call.getString("replyMode");
        String replySenderLabel = call.getString("replySenderLabel");
        String replyPreviewText = call.getString("replyPreviewText");
        if (replyMode != null && !replyMode.trim().isEmpty()) {
            intent.putExtra(NativeVideoRecorderActivity.EXTRA_REPLY_MODE, replyMode);
        }
        if (replySenderLabel != null && !replySenderLabel.trim().isEmpty()) {
            intent.putExtra(NativeVideoRecorderActivity.EXTRA_REPLY_SENDER_LABEL, replySenderLabel);
        }
        if (replyPreviewText != null && !replyPreviewText.trim().isEmpty()) {
            intent.putExtra(NativeVideoRecorderActivity.EXTRA_REPLY_PREVIEW_TEXT, replyPreviewText);
        }

        startActivityForResult(call, intent, "handleRecordResult");
    }

    @ActivityCallback
    private void handleRecordResult(PluginCall call, ActivityResult result) {
        if (call == null) {
            return;
        }

        if (result.getData() != null) {
            String error = result.getData().getStringExtra("error");
            if (error != null && !error.trim().isEmpty()) {
                call.reject(error);
                return;
            }
        }

        if (result.getResultCode() != Activity.RESULT_OK || result.getData() == null) {
            call.reject("User cancelled recording.");
            return;
        }

        Intent data = result.getData();
        JSObject response = new JSObject();
        response.put("uri", data.getStringExtra(NativeVideoRecorderActivity.RESULT_URI));
        response.put("mimeType", data.getStringExtra(NativeVideoRecorderActivity.RESULT_MIME_TYPE));
        response.put("durationMs", data.getLongExtra(NativeVideoRecorderActivity.RESULT_DURATION_MS, 0L));
        response.put("sizeBytes", data.getLongExtra(NativeVideoRecorderActivity.RESULT_SIZE_BYTES, 0L));
        call.resolve(response);
    }

    private JSObject buildPermissionsResult() {
        JSObject result = new JSObject();
        result.put("camera", getPermissionState(CAMERA).toString());
        result.put("microphone", getPermissionState(MICROPHONE).toString());
        return result;
    }
}
