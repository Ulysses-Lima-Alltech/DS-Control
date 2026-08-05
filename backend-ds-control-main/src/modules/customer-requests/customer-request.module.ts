import { app } from '@modules/app/app.module';

import { AdminCustomerRequestV1Routes } from './admin-customer-request.routes';
import { CustomerRequestV1Routes } from './customer-request.routes';

app.log.info('[CustomerRequestModule] - Initializing Customer Request Module');
app.register(CustomerRequestV1Routes, { prefix: '/v1/customer-requests' });
app.register(AdminCustomerRequestV1Routes, { prefix: '/v1/admin/customer-requests' });
