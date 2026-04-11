package com.blackway.voca.plugins;

import android.Manifest;
import android.content.Context;
import android.content.pm.PackageManager;
import android.media.AudioDeviceInfo;
import android.media.AudioManager;
import android.os.Build;
import androidx.core.content.ContextCompat;
import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import java.util.ArrayList;
import java.util.List;

@CapacitorPlugin(name = "AndroidAudioRoute")
public class AndroidAudioRoutePlugin extends Plugin {

    private static final String ROUTE_EARPIECE = "earpiece";
    private static final String ROUTE_SPEAKER = "speaker";
    private static final String ROUTE_HEADSET = "headset";
    private static final String ROUTE_BLUETOOTH = "bluetooth";

    @PluginMethod
    public void listRoutes(PluginCall call) {
        JSObject result = new JSObject();
        JSArray routes = new JSArray();

        for (RouteInfo routeInfo : resolveRoutes()) {
            JSObject route = new JSObject();
            route.put("id", routeInfo.id);
            route.put("label", routeInfo.label);
            route.put("available", routeInfo.available);
            routes.put(route);
        }

        result.put("routes", routes);
        call.resolve(result);
    }

    @PluginMethod
    public void getCurrentRoute(PluginCall call) {
        JSObject result = new JSObject();
        result.put("id", resolveCurrentRouteId());
        call.resolve(result);
    }

    @PluginMethod
    public void setRoute(PluginCall call) {
        String routeId = call.getString("id");
        if (routeId == null || routeId.trim().isEmpty()) {
            call.reject("A route id is required.");
            return;
        }

        AudioManager audioManager = getAudioManager();
        if (audioManager == null) {
            call.reject("Audio manager is unavailable.");
            return;
        }

        try {
            applyRoute(audioManager, routeId);
            call.resolve();
        } catch (Exception exception) {
            call.reject("Failed to switch audio route.", exception);
        }
    }

    @PluginMethod
    public void enterCommunicationMode(PluginCall call) {
        AudioManager audioManager = getAudioManager();
        if (audioManager == null) {
            call.reject("Audio manager is unavailable.");
            return;
        }

        audioManager.setMode(AudioManager.MODE_IN_COMMUNICATION);
        call.resolve();
    }

    @PluginMethod
    public void exitCommunicationMode(PluginCall call) {
        AudioManager audioManager = getAudioManager();
        if (audioManager == null) {
            call.resolve();
            return;
        }

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
            audioManager.clearCommunicationDevice();
        }

        audioManager.stopBluetoothSco();
        audioManager.setBluetoothScoOn(false);
        audioManager.setSpeakerphoneOn(false);
        audioManager.setMode(AudioManager.MODE_NORMAL);
        call.resolve();
    }

    private AudioManager getAudioManager() {
        Context context = getContext();
        return context == null
            ? null
            : (AudioManager) context.getSystemService(Context.AUDIO_SERVICE);
    }

    private String resolveCurrentRouteId() {
        AudioManager audioManager = getAudioManager();
        if (audioManager == null) {
            return ROUTE_SPEAKER;
        }

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
            AudioDeviceInfo currentDevice = audioManager.getCommunicationDevice();
            if (isBluetoothDevice(currentDevice)) {
                return ROUTE_BLUETOOTH;
            }
            if (isWiredHeadsetDevice(currentDevice)) {
                return ROUTE_HEADSET;
            }
            if (currentDevice != null && currentDevice.getType() == AudioDeviceInfo.TYPE_BUILTIN_EARPIECE) {
                return ROUTE_EARPIECE;
            }
            if (currentDevice != null && currentDevice.getType() == AudioDeviceInfo.TYPE_BUILTIN_SPEAKER) {
                return ROUTE_SPEAKER;
            }
        }

        if (audioManager.isBluetoothScoOn()) {
            return ROUTE_BLUETOOTH;
        }

        if (audioManager.isWiredHeadsetOn()) {
            return ROUTE_HEADSET;
        }

        return audioManager.isSpeakerphoneOn() ? ROUTE_SPEAKER : ROUTE_EARPIECE;
    }

    private List<RouteInfo> resolveRoutes() {
        AudioManager audioManager = getAudioManager();
        ArrayList<RouteInfo> routes = new ArrayList<>();
        if (audioManager == null) {
            return routes;
        }

        boolean earpieceAvailable = hasEarpiece(audioManager);
        boolean speakerAvailable = true;
        boolean headsetAvailable = hasWiredHeadsetRoute(audioManager);
        boolean bluetoothAvailable = hasBluetoothRoute(audioManager);

        routes.add(new RouteInfo(ROUTE_EARPIECE, "Phone", earpieceAvailable));
        routes.add(new RouteInfo(ROUTE_SPEAKER, "Speaker", speakerAvailable));
        if (headsetAvailable) {
            routes.add(new RouteInfo(ROUTE_HEADSET, "Headset", true));
        }
        if (bluetoothAvailable) {
            routes.add(new RouteInfo(ROUTE_BLUETOOTH, "Bluetooth", true));
        }

        return routes;
    }

    private void applyRoute(AudioManager audioManager, String routeId) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
            AudioDeviceInfo targetDevice = null;
            for (AudioDeviceInfo device : audioManager.getAvailableCommunicationDevices()) {
                if (ROUTE_EARPIECE.equals(routeId) && device.getType() == AudioDeviceInfo.TYPE_BUILTIN_EARPIECE) {
                    targetDevice = device;
                    break;
                }
                if (ROUTE_SPEAKER.equals(routeId) && device.getType() == AudioDeviceInfo.TYPE_BUILTIN_SPEAKER) {
                    targetDevice = device;
                    break;
                }
                if (ROUTE_HEADSET.equals(routeId) && isWiredHeadsetDevice(device)) {
                    targetDevice = device;
                    break;
                }
                if (ROUTE_BLUETOOTH.equals(routeId) && isBluetoothDevice(device)) {
                    targetDevice = device;
                    break;
                }
            }

            if (targetDevice != null) {
                audioManager.setCommunicationDevice(targetDevice);
                return;
            }
        }

        if (ROUTE_BLUETOOTH.equals(routeId)) {
            audioManager.setSpeakerphoneOn(false);
            audioManager.startBluetoothSco();
            audioManager.setBluetoothScoOn(true);
            return;
        }

        audioManager.stopBluetoothSco();
        audioManager.setBluetoothScoOn(false);
        audioManager.setSpeakerphoneOn(ROUTE_SPEAKER.equals(routeId));
    }

    private boolean hasEarpiece(AudioManager audioManager) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
            for (AudioDeviceInfo device : audioManager.getAvailableCommunicationDevices()) {
                if (device.getType() == AudioDeviceInfo.TYPE_BUILTIN_EARPIECE) {
                    return true;
                }
            }
        }

        return getContext().getPackageManager().hasSystemFeature(PackageManager.FEATURE_TELEPHONY);
    }

    private boolean hasBluetoothRoute(AudioManager audioManager) {
        if (!hasBluetoothPermission()) {
            return false;
        }

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
            for (AudioDeviceInfo device : audioManager.getAvailableCommunicationDevices()) {
                if (isBluetoothDevice(device)) {
                    return true;
                }
            }

            return false;
        }

        return audioManager.isBluetoothScoAvailableOffCall();
    }

    private boolean hasWiredHeadsetRoute(AudioManager audioManager) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
            for (AudioDeviceInfo device : audioManager.getAvailableCommunicationDevices()) {
                if (isWiredHeadsetDevice(device)) {
                    return true;
                }
            }

            return false;
        }

        return audioManager.isWiredHeadsetOn();
    }

    private boolean hasBluetoothPermission() {
        return Build.VERSION.SDK_INT < Build.VERSION_CODES.S ||
            ContextCompat.checkSelfPermission(getContext(), Manifest.permission.BLUETOOTH_CONNECT) ==
                PackageManager.PERMISSION_GRANTED;
    }

    private boolean isBluetoothDevice(AudioDeviceInfo device) {
        if (device == null) {
            return false;
        }

        int type = device.getType();
        return type == AudioDeviceInfo.TYPE_BLUETOOTH_SCO ||
            type == AudioDeviceInfo.TYPE_BLE_HEADSET ||
            type == AudioDeviceInfo.TYPE_BLE_SPEAKER ||
            type == AudioDeviceInfo.TYPE_HEARING_AID;
    }

    private boolean isWiredHeadsetDevice(AudioDeviceInfo device) {
        if (device == null) {
            return false;
        }

        int type = device.getType();
        return type == AudioDeviceInfo.TYPE_WIRED_HEADSET ||
            type == AudioDeviceInfo.TYPE_WIRED_HEADPHONES ||
            type == AudioDeviceInfo.TYPE_USB_HEADSET;
    }

    private static final class RouteInfo {

        final String id;
        final String label;
        final boolean available;

        RouteInfo(String id, String label, boolean available) {
            this.id = id;
            this.label = label;
            this.available = available;
        }
    }
}
