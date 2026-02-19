#!/usr/bin/env python
"""Try connecting via IPv6"""
import psycopg2
import socket

host = "db.pdkjmoayrcakcdvrfpdj.supabase.co"
password = "#natnael0336"

# Try to resolve to IPv6
try:
    ipv6 = socket.getaddrinfo(host, 5432, socket.AF_INET6)[0][4][0]
    print(f"Resolved to IPv6: {ipv6}")
    
    # Try connecting via IPv6
    conn = psycopg2.connect(
        host=ipv6,
        port=5432,
        database="postgres",
        user="postgres",
        password=password
    )
    print("[OK] Connected via IPv6!")
    conn.close()
except Exception as e:
    print(f"[ERROR] IPv6 connection failed: {e}")
    print("\nTrying alternative: Check if Supabase project is active")
    print("Go to Supabase Dashboard and verify:")
    print("1. Project status shows 'Active'")
    print("2. Database is provisioned (can take a few minutes)")







