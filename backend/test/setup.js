import dns from 'node:dns';

if (dns.setDefaultResultOrder) {
    dns.setDefaultResultOrder('ipv4first');
}
