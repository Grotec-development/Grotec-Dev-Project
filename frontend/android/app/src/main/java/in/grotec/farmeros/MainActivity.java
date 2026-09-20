package in.grotec.farmeros;

import android.os.Bundle;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(DirectCallerPlugin.class);
        super.onCreate(savedInstanceState);
    }
}
