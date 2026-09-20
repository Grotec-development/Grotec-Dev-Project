package in.grotec.farmeros;

import android.Manifest;
import android.content.Context;
import android.content.Intent;
import android.net.Uri;
import android.telephony.PhoneStateListener;
import android.telephony.TelephonyManager;
import com.getcapacitor.JSObject;
import com.getcapacitor.PermissionState;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.annotation.Permission;
import com.getcapacitor.annotation.PermissionCallback;

@CapacitorPlugin(
    name = "DirectCaller",
    permissions = {
        @Permission(
            alias = "callPhone",
            strings = { Manifest.permission.CALL_PHONE }
        ),
        @Permission(
            alias = "phoneState",
            strings = { Manifest.permission.READ_PHONE_STATE }
        )
    }
)
public class DirectCallerPlugin extends Plugin {

    private TelephonyManager telephonyManager;
    private PhoneStateListener phoneStateListener;

    @Override
    public void load() {
        super.load();
        try {
            telephonyManager = (TelephonyManager) getContext().getSystemService(Context.TELEPHONY_SERVICE);
            phoneStateListener = new PhoneStateListener() {
                @Override
                public void onCallStateChanged(int state, String phoneNumber) {
                    super.onCallStateChanged(state, phoneNumber);
                    JSObject ret = new JSObject();
                    switch (state) {
                        case TelephonyManager.CALL_STATE_RINGING:
                            ret.put("state", "RINGING");
                            break;
                        case TelephonyManager.CALL_STATE_OFFHOOK:
                            ret.put("state", "OFFHOOK");
                            break;
                        case TelephonyManager.CALL_STATE_IDLE:
                            ret.put("state", "IDLE");
                            break;
                        default:
                            return;
                    }
                    notifyListeners("callStateChanged", ret);
                }
            };
            if (telephonyManager != null) {
                telephonyManager.listen(phoneStateListener, PhoneStateListener.LISTEN_CALL_STATE);
            }
        } catch (Exception ignored) {
            // Fail gracefully if telephony service is unavailable on device/tablet
        }
    }

    @PluginMethod
    public void checkCallPermissions(PluginCall call) {
        JSObject ret = new JSObject();
        boolean granted = getPermissionState("callPhone") == PermissionState.GRANTED;
        ret.put("granted", granted);
        call.resolve(ret);
    }

    @PluginMethod
    public void requestCallPermissions(PluginCall call) {
        if (getPermissionState("callPhone") != PermissionState.GRANTED) {
            requestPermissionForAlias("callPhone", call, "callPermissionsCallback");
        } else {
            JSObject ret = new JSObject();
            ret.put("granted", true);
            call.resolve(ret);
        }
    }

    @PermissionCallback
    private void callPermissionsCallback(PluginCall call) {
        JSObject ret = new JSObject();
        boolean granted = getPermissionState("callPhone") == PermissionState.GRANTED;
        ret.put("granted", granted);
        call.resolve(ret);
    }

    @PluginMethod
    public void directCall(PluginCall call) {
        String number = call.getString("number");
        if (number == null || number.trim().isEmpty()) {
            call.reject("Phone number is required");
            return;
        }

        if (getPermissionState("callPhone") != PermissionState.GRANTED) {
            requestPermissionForAlias("callPhone", call, "directCallCallback");
            return;
        }

        executeCall(number, call);
    }

    @PermissionCallback
    private void directCallCallback(PluginCall call) {
        String number = call.getString("number");
        if (getPermissionState("callPhone") == PermissionState.GRANTED) {
            executeCall(number, call);
        } else {
            // If user denied direct call permission, fallback to system dialer
            try {
                Intent dialIntent = new Intent(Intent.ACTION_DIAL);
                dialIntent.setData(Uri.parse("tel:" + number));
                dialIntent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                getContext().startActivity(dialIntent);
                JSObject ret = new JSObject();
                ret.put("success", true);
                ret.put("message", "Permission denied, launched dialer");
                call.resolve(ret);
            } catch (Exception e) {
                call.reject("Failed to open dialer: " + e.getMessage());
            }
        }
    }

    private void executeCall(String number, PluginCall call) {
        try {
            Intent callIntent = new Intent(Intent.ACTION_CALL);
            callIntent.setData(Uri.parse("tel:" + number));
            callIntent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            getContext().startActivity(callIntent);

            JSObject ret = new JSObject();
            ret.put("success", true);
            call.resolve(ret);
        } catch (Exception e) {
            // Graceful fallback to ACTION_DIAL if ACTION_CALL fails
            try {
                Intent dialIntent = new Intent(Intent.ACTION_DIAL);
                dialIntent.setData(Uri.parse("tel:" + number));
                dialIntent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                getContext().startActivity(dialIntent);
                JSObject ret = new JSObject();
                ret.put("success", true);
                ret.put("message", "Fell back to dialer");
                call.resolve(ret);
            } catch (Exception dialErr) {
                call.reject("Could not initiate call: " + dialErr.getMessage());
            }
        }
    }
}
