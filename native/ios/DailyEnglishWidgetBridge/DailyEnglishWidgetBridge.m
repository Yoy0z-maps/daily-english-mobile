#import <React/RCTBridgeModule.h>

@interface RCT_EXTERN_MODULE(DailyEnglishWidgetBridge, NSObject)

RCT_EXTERN_METHOD(saveWidgetExpressionData:(NSDictionary *)payload
                  resolver:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)

RCT_EXTERN_METHOD(reloadAllWidgets:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)

@end
