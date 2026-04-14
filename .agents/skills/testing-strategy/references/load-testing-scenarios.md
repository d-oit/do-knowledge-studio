# Load Testing Scenarios

Pre-built load test scenarios for common use cases.

## Overview

This guide provides ready-to-use load testing scenarios for various application types and architectures. Updated with k6 v1.7.x (2026) best practices including browser testing, distributed execution, and AI-assisted test authoring.

## Latest k6 Features (v1.7.x - 2026)

### Key Updates

- **k6 Studio**: Visual test builder for creating tests without coding
- **Browser Module**: Full Playwright-compatible browser testing (v0.52+)
- **AI Assistant Integration**: MCP clients for AI-assisted test authoring
- **Distributed Testing**: Enhanced k6 Operator for Kubernetes
- **Experimental Modules**: CSV parser, file system, streams API
- **gRPC Testing**: Native protocol support with streaming

### Installation

```bash
# Latest k6 (v1.7.x as of 2026)
# macOS
brew install k6

# Linux
sudo gpg -k
sudo gpg --no-default-keyring --keyring /usr/share/keyrings/k6-archive-keyring.gpg \
  --keyserver hkp://keyserver.ubuntu.com:80 \
  --recv-keys C5AD17C747E3415A3642D57D77C6C491D6AC1D69
echo "deb [signed-by=/usr/share/keyrings/k6-archive-keyring.gpg] https://dl.k6.io/deb stable main" | \
  sudo tee /etc/apt/sources.list.d/k6.list
sudo apt-get update
sudo apt-get install k6

# Docker
docker pull grafana/k6:latest
```

## API Load Testing

### REST API Scenario (2026 Best Practices)

```javascript
// k6-rest-api.js
import http from 'k6/http';
import { check, sleep, group } from 'k6';

// Scenario-based configuration (recommended in 2026)
export const options = {
  scenarios: {
    // Different user behaviors
    browse: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: [
        { duration: '2m', target: 100 },   // Ramp up
        { duration: '5m', target: 100 },   // Steady state
        { duration: '2m', target: 200 },    // Increase load
        { duration: '5m', target: 200 },   // Steady state
        { duration: '2m', target: 0 },     // Ramp down
      ],
      gracefulRampDown: '30s',
    },
    // Arrival-rate based (more realistic for APIs)
    api_requests: {
      executor: 'ramping-arrival-rate',
      startRate: 50,
      timeUnit: '1s',
      preAllocatedVUs: 50,
      maxVUs: 200,
      stages: [
        { duration: '2m', target: 100 },    // 100 req/s
        { duration: '5m', target: 100 },
        { duration: '2m', target: 200 },    // 200 req/s
        { duration: '5m', target: 200 },
      ],
    },
  },
  thresholds: {
    http_req_duration: ['p(95)<500'],     // 95% under 500ms
    http_req_duration: ['p(99)<1000'],    // 99% under 1s
    http_req_failed: ['rate<0.01'],      // Error rate < 1%
    'http_req_duration{scenario:api_requests}': ['p(95)<300'], // Per-scenario
  },
  // Cloud output configuration
  ext: {
    loadimpact: {
      distribution: {
        'amazon:us:ashburn': { loadZone: 'amazon:us:ashburn', percent: 50 },
        'amazon:de:frankfurt': { loadZone: 'amazon:de:frankfurt', percent: 50 },
      },
    },
  },
};

const BASE_URL = __ENV.BASE_URL || 'https://api.example.com';

export function browse() {
  group('Browse Flow', () => {
    // GET request with tags for filtering
    const getRes = http.get(`${BASE_URL}/api/users`, {
      tags: { name: 'users_list', type: 'read' },
    });
    
    check(getRes, {
      'GET status is 200': (r) => r.status === 200,
      'GET response time < 500ms': (r) => r.timings.duration < 500,
      'content-type is json': (r) => r.headers['Content-Type'].includes('application/json'),
    });

    sleep(Math.random() * 3 + 1); // Think time: 1-4 seconds
  });
}

export function api_requests() {
  group('API Operations', () => {
    // POST request with payload
    const payload = JSON.stringify({
      name: `User_${__VU}_${__ITER}`,
      email: `user${__VU}_${__ITER}@test.com`,
      timestamp: new Date().toISOString(),
    });
    
    const postRes = http.post(`${BASE_URL}/api/users`, payload, {
      headers: { 
        'Content-Type': 'application/json',
        'X-Request-ID': `req-${__VU}-${__ITER}`,
      },
      tags: { name: 'users_create', type: 'write' },
    });
    
    check(postRes, {
      'POST status is 201': (r) => r.status === 201,
      'POST response time < 800ms': (r) => r.timings.duration < 800,
      'has user id': (r) => JSON.parse(r.body).id !== undefined,
    });

    sleep(0.5);
  });
}
```

### GraphQL Scenario with Subscriptions

```javascript
// k6-graphql-advanced.js
import http from 'k6/http';
import ws from 'k6/ws';  // WebSocket module for subscriptions
import { check } from 'k6';

export const options = {
  vus: 50,
  duration: '10m',
  thresholds: {
    http_req_duration: ['p(95)<300'],
    ws_connecting_duration: ['p(95)<500'], // WebSocket connection time
  },
};

const query = `
  query GetUserWithPosts($id: ID!, $limit: Int = 10) {
    user(id: $id) {
      id
      name
      email
      posts(limit: $limit) {
        title
        content
        createdAt
        comments {
          author
          text
        }
      }
    }
  }
`;

const subscription = `
  subscription OnUserActivity($userId: ID!) {
    userActivity(userId: $userId) {
      type
      timestamp
      metadata
    }
  }
`;

// HTTP GraphQL query
export function graphqlQuery() {
  const res = http.post(
    'https://api.example.com/graphql',
    JSON.stringify({
      query: query,
      variables: { 
        id: Math.floor(Math.random() * 10000) + 1,
        limit: Math.floor(Math.random() * 20) + 5,
      },
      operationName: 'GetUserWithPosts',
    }),
    {
      headers: {
        'Content-Type': 'application/json',
      },
      tags: { type: 'graphql_query' },
    }
  );

  check(res, {
    'status is 200': (r) => r.status === 200,
    'no GraphQL errors': (r) => {
      const body = JSON.parse(r.body);
      return !body.errors;
    },
    'response time < 300ms': (r) => r.timings.duration < 300,
    'has data': (r) => {
      const body = JSON.parse(r.body);
      return body.data && body.data.user;
    },
  });
}

// WebSocket subscription test
export function graphqlSubscription() {
  const url = 'wss://api.example.com/graphql';
  const userId = Math.floor(Math.random() * 1000) + 1;
  
  const res = ws.connect(url, {}, function(socket) {
    socket.on('open', () => {
      // Send subscription request
      socket.send(JSON.stringify({
        type: 'subscribe',
        id: `sub-${__VU}-${__ITER}`,
        payload: {
          query: subscription,
          variables: { userId },
        },
      }));
    });

    socket.on('message', (msg) => {
      const data = JSON.parse(msg);
      check(data, {
        'received data': (d) => d.type === 'data',
        'has payload': (d) => d.payload !== undefined,
      });
    });

    socket.on('close', () => {
      console.log(`Subscription closed for user ${userId}`);
    });

    // Close after 30 seconds
    socket.setTimeout(() => {
      socket.close();
    }, 30000);
  });

  check(res, {
    'WebSocket connected': (r) => r && r.status === 101,
    'connected in < 500ms': (r) => r.timings.duration < 500,
  });
}
```

## Browser Testing with k6 (2026)

### Hybrid Performance Testing

```javascript
// k6-browser-hybrid.js
import { browser } from 'k6/experimental/browser';  // v0.52+
import http from 'k6/http';
import { check } from 'k6';

export const options = {
  scenarios: {
    // Browser-based testing for Core Web Vitals
    browser_test: {
      executor: 'shared-iterations',
      vus: 5,
      iterations: 10,
      options: {
        browser: {
          type: 'chromium',
        },
      },
    },
    // API load test
    api_test: {
      executor: 'constant-vus',
      vus: 50,
      duration: '5m',
      startTime: '30s',  // Start after browser test begins
    },
  },
  thresholds: {
    // Core Web Vitals thresholds (2026 standards)
    'browser_web_vital_lcp': ['p(75)<2500'],  // Largest Contentful Paint < 2.5s
    'browser_web_vital_fid': ['p(75)<100'],    // First Input Delay < 100ms
    'browser_web_vital_cls': ['p(75)<0.1'],    // Cumulative Layout Shift < 0.1
    'browser_web_vital_inp': ['p(75)<200'],    // Interaction to Next Paint < 200ms
    http_req_duration: ['p(95)<500'],
  },
};

export async function browser_test() {
  const context = browser.newContext();
  const page = context.newPage();

  try {
    // Navigate and measure
    await page.goto('https://example.com/login', {
      waitUntil: 'networkidle',
    });

    // Fill form using Playwright-compatible API
    await page.locator('input[name="username"]').fill(`user${__VU}`);
    await page.locator('input[name="password"]').fill('password123');
    
    // Click and wait for navigation
    const [response] = await Promise.all([
      page.waitForNavigation(),
      page.locator('button[type="submit"]').click(),
    ]);

    check(response, {
      'login successful': (r) => r.status() === 200,
      'redirected to dashboard': () => page.url().includes('/dashboard'),
    });

    // Measure specific user interactions
    await page.locator('[data-testid="load-data"]').click();
    await page.waitForSelector('[data-testid="data-loaded"]');

    // Take screenshot for debugging
    await page.screenshot({ path: `screenshots/test-${__VU}-${__ITER}.png` });

  } finally {
    await page.close();
    await context.close();
  }
}

export function api_test() {
  // Background API load while browser tests run
  const res = http.get('https://api.example.com/data');
  
  check(res, {
    'api status is 200': (r) => r.status === 200,
    'api response fast': (r) => r.timings.duration < 300,
  });
}
```

### E-commerce Checkout Flow with Browser

```javascript
// k6-ecommerce-browser.js
import { browser } from 'k6/experimental/browser';
import { check, sleep, group } from 'k6';

export const options = {
  scenarios: {
    browse: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: [
        { duration: '1m', target: 50 },
        { duration: '3m', target: 50 },
        { duration: '1m', target: 0 },
      ],
      options: {
        browser: {
          type: 'chromium',
        },
      },
    },
    checkout: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: [
        { duration: '1m', target: 10 },
        { duration: '3m', target: 10 },
        { duration: '1m', target: 0 },
      ],
      options: {
        browser: {
          type: 'chromium',
        },
      },
    },
  },
};

export async function browse() {
  const context = browser.newContext();
  const page = context.newPage();

  try {
    await group('Browse Products', async () => {
      await page.goto('https://shop.example.com/products');
      
      check(page, {
        'products page loaded': (p) => p.locator('.product-list').isVisible(),
        'no errors': (p) => !p.locator('.error-message').isVisible(),
      });

      // Simulate realistic browsing
      await page.locator('.product-card').first().click();
      sleep(Math.random() * 3 + 1);
      
      // Scroll and interact
      await page.evaluate(() => window.scrollBy(0, 500));
      sleep(Math.random() * 2 + 0.5);
    });

  } finally {
    await page.close();
    await context.close();
  }
}

export async function checkout() {
  const context = browser.newContext();
  const page = context.newPage();

  try {
    await group('Full Checkout Flow', async () => {
      // Add to cart
      await page.goto(`https://shop.example.com/products/${Math.floor(Math.random() * 100)}`);
      await page.locator('button[data-testid="add-to-cart"]').click();
      await page.waitForSelector('.cart-count');

      // Go to cart
      await page.goto('https://shop.example.com/cart');
      check(page, {
        'cart has items': (p) => p.locator('.cart-item').count() > 0,
      });

      // Proceed to checkout
      await page.locator('button[data-testid="checkout"]').click();
      
      // Fill shipping info
      await page.locator('input[name="name"]').fill('Test User');
      await page.locator('input[name="address"]').fill('123 Test St');
      await page.locator('input[name="city"]').fill('Test City');
      
      // Simulate payment
      await page.locator('button[data-testid="place-order"]').click();
      
      // Wait for confirmation
      await page.waitForSelector('.order-confirmation', { timeout: 10000 });
      
      check(page, {
        'order confirmed': (p) => p.locator('.order-confirmation').isVisible(),
        'has order number': (p) => p.locator('.order-number').textContent().length > 0,
      });
    });

  } finally {
    await page.close();
    await context.close();
  }
}
```

## WebSocket Testing

### Real-time Chat with Reconnection

```javascript
// k6-websocket-advanced.js
import ws from 'k6/ws';
import { check, sleep } from 'k6';
import { Counter, Trend } from 'k6/metrics';

// Custom metrics
const reconnections = new Counter('websocket_reconnections');
const messageLatency = new Trend('message_latency');

export const options = {
  vus: 100,
  duration: '10m',
  thresholds: {
    'message_latency': ['p(95)<500'],  // Message latency under 500ms
    'websocket_reconnections': ['count<10'],  // Max 10 reconnections
  },
};

export default function() {
  const url = 'wss://chat.example.com/ws';
  const roomId = `room-${Math.floor(__VU / 10)}`;  // Group users into rooms
  let messageCount = 0;
  let reconnectCount = 0;
  
  const connect = () => {
    const res = ws.connect(url, {
      headers: {
        'X-User-ID': `user-${__VU}`,
      },
    }, function(socket) {
      let connected = false;
      let pingInterval;
      
      socket.on('open', () => {
        connected = true;
        
        // Join room
        socket.send(JSON.stringify({
          type: 'join',
          room: roomId,
          user: `user-${__VU}`,
        }));

        // Send heartbeat
        pingInterval = socket.setInterval(() => {
          socket.send(JSON.stringify({ type: 'ping', timestamp: Date.now() }));
        }, 30000);
      });

      socket.on('message', (msg) => {
        const data = JSON.parse(msg);
        
        check(data, {
          'valid message format': (d) => d.type !== undefined,
        });

        if (data.type === 'message') {
          messageCount++;
          // Calculate latency if timestamp included
          if (data.timestamp) {
            const latency = Date.now() - data.timestamp;
            messageLatency.add(latency);
          }
        }
        
        if (data.type === 'pong') {
          // Heartbeat response
        }
      });

      socket.on('close', (code, reason) => {
        connected = false;
        if (pingInterval) clearInterval(pingInterval);
        
        check(null, {
          'clean disconnect': () => code === 1000,
        });
      });

      socket.on('error', (e) => {
        console.error(`WebSocket error for user ${__VU}:`, e.error());
      });

      // Send messages periodically
      const messageInterval = socket.setInterval(() => {
        if (connected) {
          socket.send(JSON.stringify({
            type: 'message',
            room: roomId,
            text: `Test message ${messageCount} from user ${__VU}`,
            timestamp: Date.now(),
          }));
        }
      }, 5000);

      // Close after duration
      socket.setTimeout(() => {
        clearInterval(messageInterval);
        socket.close();
      }, 300000);  // 5 minutes
    });

    return res;
  };

  // Initial connection
  let res = connect();
  
  check(res, {
    'WebSocket connected': (r) => r && r.status === 101,
  });

  // Reconnection logic (simulating network issues)
  sleep(60);
  if (Math.random() < 0.1) {  // 10% chance of reconnection
    reconnectCount++;
    reconnections.add(1);
    sleep(5);
    res = connect();
  }
}
```

## gRPC Load Testing

### gRPC Streaming Scenario

```javascript
// k6-grpc.js
import grpc from 'k6/net/grpc';
import { check, sleep } from 'k6';

const client = new grpc.Client();
client.load(['./protos'], 'service.proto');

export const options = {
  vus: 50,
  duration: '5m',
  thresholds: {
    grpc_req_duration: ['p(95)<300'],
    grpc_streams: ['count>100'],
  },
};

export default function() {
  client.connect('grpc.example.com:443', {
    plaintext: false,
    timeout: '10s',
  });

  // Unary call
  const response = client.invoke('myPackage.MyService/MyMethod', {
    id: __VU,
    message: `Request from VU ${__VU}, iteration ${__ITER}`,
  });

  check(response, {
    'status is OK': (r) => r && r.status === grpc.StatusOK,
    'has response': (r) => r && r.message !== undefined,
    'response time < 300ms': (r) => r && r.timings.duration < 300,
  });

  // Streaming call
  const stream = client.openStream('myPackage.MyService/MyStreamingMethod', {
    id: __VU,
  });

  stream.on('data', (data) => {
    check(data, {
      'stream data received': (d) => d !== undefined,
    });
  });

  stream.on('error', (error) => {
    console.error('Stream error:', error);
  });

  // Send multiple messages
  for (let i = 0; i < 10; i++) {
    stream.write({
      sequence: i,
      payload: `Message ${i}`,
    });
    sleep(0.1);
  }

  stream.close();
  client.close();
  sleep(1);
}
```

## Database Load Testing

### PostgreSQL with Connection Pooling

```python
# locust-postgres-advanced.py
from locust import User, task, between, events
import psycopg2
import psycopg2.pool
import random
import time
from contextlib import contextmanager

class PostgresUser(User):
    wait_time = between(0.1, 2)
    
    def __init__(self, environment):
        super().__init__(environment)
        self.db_pool = None
    
    def on_start(self):
        # Initialize connection pool per user
        self.db_pool = psycopg2.pool.ThreadedConnectionPool(
            minconn=1,
            maxconn=5,
            host='localhost',
            database='testdb',
            user='testuser',
            password='testpass',
            port=5432,
            connect_timeout=10,
        )
    
    def on_stop(self):
        if self.db_pool:
            self.db_pool.closeall()
    
    @contextmanager
    def get_connection(self):
        conn = None
        try:
            conn = self.db_pool.getconn()
            yield conn
        finally:
            if conn:
                self.db_pool.putconn(conn)
    
    @task(10)
    def read_user_with_cache(self):
        """Simulate read-heavy workload with caching pattern"""
        user_id = random.randint(1, 10000)
        
        with self.get_connection() as conn:
            with conn.cursor() as cur:
                start = time.time()
                cur.execute(
                    """
                    SELECT u.*, p.title, p.content 
                    FROM users u 
                    LEFT JOIN posts p ON p.user_id = u.id 
                    WHERE u.id = %s 
                    LIMIT 5
                    """,
                    (user_id,)
                )
                results = cur.fetchall()
                duration = (time.time() - start) * 1000
                
                if duration > 500:
                    self.environment.events.request.fire(
                        request_type="DB",
                        name="slow_query",
                        response_time=duration,
                        response_length=0,
                        context=None,
                        exception=None,
                    )
                
                assert len(results) >= 0  # At least don't error
    
    @task(5)
    def write_transaction(self):
        """Simulate write workload with transactions"""
        with self.get_connection() as conn:
            try:
                with conn.cursor() as cur:
                    # Start transaction
                    cur.execute("BEGIN")
                    
                    # Insert order
                    cur.execute("""
                        INSERT INTO orders (user_id, product_id, quantity, status)
                        VALUES (%s, %s, %s, 'pending')
                        RETURNING id
                    """, (
                        random.randint(1, 1000),
                        random.randint(1, 100),
                        random.randint(1, 5)
                    ))
                    order_id = cur.fetchone()[0]
                    
                    # Update inventory
                    cur.execute("""
                        UPDATE inventory 
                        SET quantity = quantity - %s 
                        WHERE product_id = %s
                    """, (random.randint(1, 5), random.randint(1, 100)))
                    
                    # Commit
                    conn.commit()
                    
            except Exception as e:
                conn.rollback()
                raise
    
    @task(3)
    def complex_query(self):
        """Simulate complex analytical query"""
        with self.get_connection() as conn:
            with conn.cursor() as cur:
                cur.execute("""
                    SELECT 
                        u.id,
                        u.name,
                        COUNT(o.id) as order_count,
                        SUM(o.total) as total_spent,
                        AVG(o.total) as avg_order_value
                    FROM users u
                    LEFT JOIN orders o ON o.user_id = u.id
                    WHERE u.created_at > NOW() - INTERVAL '30 days'
                    GROUP BY u.id, u.name
                    HAVING COUNT(o.id) > 0
                    ORDER BY total_spent DESC
                    LIMIT 100
                """)
                results = cur.fetchall()
                assert len(results) >= 0
```

## Spike and Stress Testing

### Sudden Traffic Spike

```javascript
// k6-spike.js
import http from 'k6/http';
import { check } from 'k6';

export const options = {
  scenarios: {
    spike: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: [
        { duration: '2m', target: 100 },    // Normal load
        { duration: '10s', target: 5000 },   // Sudden massive spike
        { duration: '3m', target: 5000 },    // Sustained high load
        { duration: '30s', target: 100 },    // Quick recovery
        { duration: '2m', target: 100 },      // Verify stability
        { duration: '30s', target: 0 },      // Ramp down
      ],
      gracefulRampDown: '30s',
    },
  },
  thresholds: {
    http_req_duration: ['p(99)<3000'],  // 99th percentile under 3s even during spike
    http_req_failed: ['rate<0.05'],      // Error rate < 5% during spike
  },
};

export default function() {
  const res = http.get('https://api.example.com/health', {
    tags: { type: 'health_check' },
  });
  
  check(res, {
    'status is 200': (r) => r.status === 200,
    'response time < 3s': (r) => r.timings.duration < 3000,
    'no error response': (r) => !r.body.includes('error'),
  });
}
```

### Soak Testing (Long-duration Stability)

```javascript
// k6-soak.js
import http from 'k6/http';
import { check, sleep } from 'k6';
import { Counter, Trend, Rate } from 'k6/metrics';

// Custom metrics for memory leak detection
const memoryUsage = new Trend('memory_usage_mb');
const errorRate = new Rate('custom_errors');

export const options = {
  stages: [
    { duration: '5m', target: 100 },     // Ramp up
    { duration: '8h', target: 100 },      // Stay at 100 for 8 hours
    { duration: '5m', target: 0 },       // Ramp down
  ],
  thresholds: {
    http_req_duration: ['p(95)<500'],
    http_req_failed: ['rate<0.001'],       // Very low error rate
    custom_errors: ['rate<0.01'],
  },
};

export default function() {
  const startTime = Date.now();
  
  // Multiple endpoints to exercise full application
  const endpoints = [
    '/api/users',
    '/api/products',
    '/api/orders',
    '/health',
  ];
  
  const endpoint = endpoints[Math.floor(Math.random() * endpoints.length)];
  
  const res = http.get(`https://api.example.com${endpoint}`, {
    tags: { endpoint },
  });
  
  check(res, {
    'status is 200': (r) => r.status === 200,
    'no memory leak indicator': (r) => {
      // Check for memory-related errors
      const body = r.body;
      return !body.includes('OutOfMemory') && 
             !body.includes('Memory limit exceeded');
    },
    'response valid': (r) => {
      try {
        const json = JSON.parse(r.body);
        return json !== null;
      } catch {
        return r.status === 200;  // Allow non-JSON health checks
      }
    },
  });
  
  // Track custom error conditions
  if (res.status >= 500) {
    errorRate.add(1);
  }
  
  // Simulate realistic user think time (1-5 seconds)
  sleep(Math.random() * 4 + 1);
  
  // Log progress every 1000 iterations
  if (__ITER % 1000 === 0) {
    console.log(`VU ${__VU} completed ${__ITER} iterations`);
  }
}
```

## Distributed Load Testing

### Kubernetes with k6 Operator

```yaml
# k6-test-crd.yaml
apiVersion: k6.io/v1alpha1
kind: TestRun
metadata:
  name: distributed-load-test
spec:
  parallelism: 10  # Run across 10 pods
  script:
    configMap:
      name: k6-test-scripts
      file: load-test.js
  arguments: --out cloud
  runner:
    env:
      - name: K6_OUT
        value: 'cloud'
      - name: K6_CLOUD_TOKEN
        valueFrom:
          secretKeyRef:
            name: k6-secrets
            key: token
    resources:
      limits:
        cpu: '2'
        memory: '4Gi'
      requests:
        cpu: '1'
        memory: '2Gi'
```

## Running Load Tests

### Local Execution

```bash
# Run k6 test locally
k6 run k6-rest-api.js

# Run with custom environment variables
BASE_URL=https://staging.api.com k6 run k6-rest-api.js

# Run with specific VUs and duration
k6 run --vus 100 --duration 30s k6-rest-api.js

# Run browser tests (requires k6 v0.52+)
K6_BROWSER_HEADLESS=false k6 run k6-browser-hybrid.js

# Output to multiple destinations
k6 run --out json=results.json --out csv=results.csv --out cloud k6-test.js
```

### Cloud Execution

```bash
# Run on Grafana Cloud k6
k6 cloud run k6-rest-api.js

# Run with cloud output from local
k6 run --out cloud k6-rest-api.js

# Distributed cloud execution
k6 cloud run --distribution amazon:us:ashburn=50,amazon:de:frankfurt=50 k6-test.js
```

### CI/CD Integration (2026 Best Practices)

```yaml
# .github/workflows/load-test.yml
name: Load Test

on:
  schedule:
    - cron: '0 2 * * 1'  # Weekly on Monday at 2 AM
  workflow_dispatch:     # Manual trigger
    inputs:
      environment:
        description: 'Environment to test'
        required: true
        default: 'staging'
        type: choice
        options:
          - staging
          - production

jobs:
  load-test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      
      - name: Setup k6
        uses: grafana/setup-k6-action@v1
        with:
          k6-version: 'latest'
      
      - name: Run smoke test
        run: k6 run --vus 10 --duration 1m ./load-tests/smoke-test.js
        env:
          BASE_URL: ${{ github.event.inputs.environment == 'production' && secrets.PROD_URL || secrets.STAGING_URL }}
      
      - name: Run full load test
        run: k6 run ./load-tests/k6-rest-api.js
        env:
          BASE_URL: ${{ github.event.inputs.environment == 'production' && secrets.PROD_URL || secrets.STAGING_URL }}
          K6_CLOUD_TOKEN: ${{ secrets.K6_CLOUD_TOKEN }}
        continue-on-error: true  # Don't block on performance regression
      
      - name: Upload results
        uses: actions/upload-artifact@v4
        with:
          name: k6-results
          path: |
            results.json
            results.csv
      
      - name: Comment PR with results
        if: github.event_name == 'pull_request'
        uses: grafana/k6-report-action@v1
        with:
          file: results.json
```

## Performance Benchmarks (2026)

### Updated Thresholds

| Metric | Good | Warning | Critical |
|--------|------|---------|----------|
| Response Time (p50) | < 100ms | 100-300ms | > 300ms |
| Response Time (p95) | < 300ms | 300-800ms | > 800ms |
| Response Time (p99) | < 500ms | 500-1500ms | > 1500ms |
| Error Rate | < 0.1% | 0.1-0.5% | > 0.5% |
| Throughput | Baseline | -10% | -25% |
| LCP (Largest Contentful Paint) | < 2.5s | 2.5-4s | > 4s |
| FID (First Input Delay) | < 100ms | 100-300ms | > 300ms |
| CLS (Cumulative Layout Shift) | < 0.1 | 0.1-0.25 | > 0.25 |
| INP (Interaction to Next Paint) | < 200ms | 200-500ms | > 500ms |

## Best Practices (2026)

1. **Use Scenarios**: Define realistic user journeys instead of simple VU counts
2. **Arrival-rate Modeling**: Use arrival-rate executors for more realistic API load
3. **Browser + API Hybrid**: Combine protocol-level and browser-level testing
4. **Core Web Vitals**: Monitor LCP, FID, CLS, INP for user-facing applications
5. **Distributed Testing**: Use k6 Operator for large-scale tests
6. **AI-Assisted Authoring**: Use k6's AI assistant for generating test scripts
7. **Realistic Data**: Use production-like data volumes and patterns
8. **Gradual Ramp-up**: Always include warm-up periods
9. **Monitor Infrastructure**: Track server metrics alongside test metrics
10. **Fail on Thresholds**: Integrate with CI/CD gates for performance regression

## Resources

- [k6 Documentation](https://grafana.com/docs/k6/latest/)
- [k6 Browser Testing](https://grafana.com/docs/k6/latest/using-k6-browser/)
- [Core Web Vitals](https://web.dev/vitals/)
- [Grafana Cloud k6](https://grafana.com/products/cloud/k6/)
