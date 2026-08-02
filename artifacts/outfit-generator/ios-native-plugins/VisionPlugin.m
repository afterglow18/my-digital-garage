#import <Foundation/Foundation.h>
#import <Capacitor/Capacitor.h>

// Register the VisionPlugin with the Capacitor bridge.
// The Swift class name must match exactly: VisionPlugin
CAP_PLUGIN(VisionPlugin, "VisionPlugin",
    CAP_PLUGIN_METHOD(analyze, CAPPluginReturnPromise);
)
