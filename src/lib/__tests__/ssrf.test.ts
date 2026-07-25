import { describe, it, expect } from 'vitest'
import { isPrivateIP } from '../ai/research'

describe('SSRF & Private Network Protection', () => {
  const blockedHosts = [
    // IPv4 standard representation
    '127.0.0.1',
    '127.0.0.2',
    '127.12.34.56',
    '10.0.0.1',
    '10.255.255.254',
    '172.16.0.1',
    '172.31.255.254',
    '192.168.1.1',
    '192.168.254.254',
    '169.254.169.254',
    '0.0.0.0',
    '0.1.2.3',
    '100.64.0.1',
    '100.127.255.254',
    '192.0.0.1',
    '192.0.2.1',
    '198.51.100.1',
    '203.0.113.1',
    '224.0.0.1',
    '240.0.0.1',
    '255.255.255.255',

    // Local hostnames & domain suffixes
    'localhost',
    'my-router',
    'nas-server',
    'router.local',
    'service.internal',
    'app.localhost',
    'workstation.lan',
    'test-suite.test',
    'site.invalid',
    'api.example',
    'secret.onion',

    // Decimal IPv4 representation
    '2130706433', // 127.0.0.1
    '167772161',  // 10.0.0.1

    // Hexadecimal IPv4 representation
    '0x7f000001', // 127.0.0.1
    '0x0a000001', // 10.0.0.1
    '0x7f.0x0.0x0.0x1', // mixed hex 127.0.0.1

    // Octal IPv4 representation
    '017700000001', // 127.0.0.1
    '0177.0.0.1',   // 127.0.0.1 mixed
    '012.0.0.1',    // 10.0.0.1 octal/mixed

    // IPv6 Loopback, Link-Local, Unique Local, Multicast
    '::1',
    '::',
    '0:0:0:0:0:0:0:1',
    '0:0:0:0:0:0:0:0',
    'fe80::1',
    'fe80::dead:beef',
    'fc00::',
    'fdff::1234',
    'ff02::1',
    'ff02::fb',

    // IPv4-mapped IPv6
    '::ffff:127.0.0.1',
    '::ffff:10.0.0.1',
    '::ffff:0x7f000001',
    '::ffff:2130706433',
  ]

  const allowedHosts = [
    'google.com',
    'github.com',
    'wikipedia.org',
    '8.8.8.8',
    '1.1.1.1',
    '134744072', // 8.8.8.8 decimal representation
    '16843009',  // 1.1.1.1 decimal representation
    '2001:4860:4860::8888', // Google Public DNS IPv6
    'example.com',
  ]

  describe('Blocked Hosts (Private/Reserved/Local)', () => {
    it.each(blockedHosts)('should identify "%s" as a private/local host', (host) => {
      expect(isPrivateIP(host)).toBe(true)
    })
  })

  describe('Allowed Hosts (Public)', () => {
    it.each(allowedHosts)('should identify "%s" as a public/allowed host', (host) => {
      expect(isPrivateIP(host)).toBe(false)
    })
  })
})
