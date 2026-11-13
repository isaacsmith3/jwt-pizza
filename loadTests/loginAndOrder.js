import { sleep, check, group, fail } from 'k6';
import http from 'k6/http';

const FRONTEND = 'https://pizza.isaacws.online';
const SERVICE = 'https://pizza-service.isaacws.online';
const FACTORY = 'https://pizza-factory.cs329.click';

export const options = {
  cloud: {
    distribution: { 'amazon:us:ashburn': { loadZone: 'amazon:us:ashburn', percent: 100 } },
    name: 'Login and order pizza',
  },
  thresholds: {},
  scenarios: {
    Scenario_1: {
      executor: 'ramping-vus',
      gracefulStop: '30s',
      stages: [
        { target: 5, duration: '30s' },
        { target: 10, duration: '1m' },
        { target: 10, duration: '1m30s' },
        { target: 0, duration: '30s' },
      ],
      gracefulRampDown: '30s',
      exec: 'scenario_1',
    },
  },
};

const jsonHeaders = (token) => {
  const h = {
    accept: '*/*',
    'content-type': 'application/json',
    origin: FRONTEND,
  };
  if (token) h.authorization = `Bearer ${token}`;
  return h;
};

export function scenario_1() {
  let response;
  const vars = {};

  group('Home page', function () {
    response = http.get(`${FRONTEND}/`, { tags: { name: 'Home page' } });
    check(response, { 'home page 200': (r) => r.status === 200 });
    sleep(2);
  });

  group('Login', function () {
    response = http.put(
      `${SERVICE}/api/auth`,
      JSON.stringify({ email: 'd@jwt.com', password: 'diner' }), // password got flagged by grafana but is non sensitive
      { headers: jsonHeaders(), tags: { name: 'Login' } }
    );
    if (!check(response, { 'login status equals 200': (r) => r.status.toString() === '200' })) {
      console.log(response.body);
      fail('Login was *not* 200');
    }
    vars.authToken = response.json().token;
    sleep(2);
  });

  group('Browse menu and stores', function () {
    response = http.get(`${SERVICE}/api/order/menu`, {
      headers: jsonHeaders(vars.authToken),
      tags: { name: 'Get menu' },
    });
    check(response, { 'menu 200': (r) => r.status === 200 });

    response = http.get(`${SERVICE}/api/franchise?page=0&limit=20&name=*`, {
      headers: jsonHeaders(vars.authToken),
      tags: { name: 'Get franchises' },
    });
    check(response, { 'franchises 200': (r) => r.status === 200 });
    sleep(2);
  });

  group('Purchase pizza', function () {
    response = http.post(
      `${SERVICE}/api/order`,
      JSON.stringify({
        items: [{ menuId: 1, description: 'Veggie', price: 0.0038 }],
        storeId: '1',
        franchiseId: 1,
      }),
      { headers: jsonHeaders(vars.authToken), tags: { name: 'Purchase pizza' } }
    );
    check(response, { 'purchase status equals 200': (r) => r.status === 200 });
    vars.pizzaJwt = response.status === 200 ? response.json().jwt : null;
    sleep(2);
  });

  group('Verify pizza', function () {
    if (vars.pizzaJwt) {
      response = http.post(
        `${FACTORY}/api/order/verify`,
        JSON.stringify({ jwt: vars.pizzaJwt }),
        { headers: jsonHeaders(vars.authToken), tags: { name: 'Verify pizza' } }
      );
      check(response, { 'pizza JWT is valid': (r) => r.status === 200 && r.json().message === 'valid' });
    }
    sleep(2);
  });

  group('Logout', function () {
    response = http.del(`${SERVICE}/api/auth`, null, {
      headers: jsonHeaders(vars.authToken),
      tags: { name: 'Logout' },
    });
    check(response, { 'logout 200': (r) => r.status === 200 });
    sleep(2);
  });
}
