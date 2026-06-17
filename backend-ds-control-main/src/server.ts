import "dotenv/config";

import "@infra/bullmq";
import "@modules/app/app.module";

import "@modules/application/application.module";
import "@modules/assistant/assistant.module";
import "@modules/authentication/authentication.module";
import "@modules/contract/contract.module";
import "@modules/crop-season/crop-season.module";
import "@modules/culture-type/culture-type.module";
import "@modules/customer/customer.module";
import "@modules/dji/dji.module";
import "@modules/drone/drone.module";
import "@modules/farm/farm.module";
import "@integrations/dji/dji.module";
import "@modules/plot/plot.module";
import "@modules/product/product.module";
import "@modules/route/route.module";
import "@modules/service-order/service-order.module";
import "@modules/user/user.module";
