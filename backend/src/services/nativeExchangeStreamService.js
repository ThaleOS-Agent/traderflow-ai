import {
  exchangeGatewayService,
  SUPPORTED_NATIVE_WS_VENUES
} from './exchangeGateway.js';

export const nativeExchangeStreamService = {
  attach(options) {
    exchangeGatewayService.attach(options);
  },

  initialize(options) {
    return exchangeGatewayService.initialize(options);
  },

  subscribe(options) {
    return exchangeGatewayService.subscribe(options);
  },

  unsubscribe(options) {
    return exchangeGatewayService.unsubscribe(options);
  },

  getStatus() {
    return exchangeGatewayService.getStatus();
  },

  queueExecution(options) {
    return exchangeGatewayService.queueExecution(options);
  },

  previewRoute(options) {
    return exchangeGatewayService.previewRoute(options);
  }
};

export { SUPPORTED_NATIVE_WS_VENUES };
