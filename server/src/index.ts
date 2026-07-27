import register from './register';
import controllers from './controllers';
import services from './services';
import routes from './routes';

export default {
  register,
  bootstrap() {},
  destroy() {},
  config: {
    default: {},
    validator() {},
  },
  controllers,
  routes,
  services,
};
