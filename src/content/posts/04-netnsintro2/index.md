---
title: Iptables로 리눅스 가상 네트워크 통신 제어하기
published: 2025-07-01
tags: [Linux, Network, System]
category: System
image: ./cover.png
draft: true
---

```bash
sudo sysctl -w net.bridge.bridge-nf-call-iptables=1
sysctl -w net.ipv4.ip_forward=1

ip netns exec red ping 10.16.0.3 -c 3
# PING 10.16.0.3 (10.16.0.3) 56(84) bytes of data.
# ...
# --- 10.16.0.3 ping statistics ---
# 3 packets transmitted, 0 received, 100% packet loss, time 2061ms

iptables -L | grep FORWARD
# Chain FORWARD (policy DROP)

# FOWARD 체인 만들기, 룰 체인에 넣기\, RETURN 로직까지 넣기
iptables -N NAVY
iptables -I FORWARD 1 -j NAVY
iptables -A  NAVY -j RETURN
iptables -I NAVY 1 -s 10.16.0.0/24 -d 10.16.0.0/24 -j ACCEPT

# ping 날아가는거 확인하기
ip netns exec red ping 10.16.0.3 -c 3
PING 10.16.0.3 (10.16.0.3) 56(84) bytes of data.
64 bytes from 10.16.0.3: icmp_seq=1 ttl=64 time=0.363 ms
64 bytes from 10.16.0.3: icmp_seq=2 ttl=64 time=0.056 ms
64 bytes from 10.16.0.3: icmp_seq=3 ttl=64 time=0.062 ms

--- 10.16.0.3 ping statistics ---
3 packets transmitted, 3 received, 0% packet loss, time 2027ms
rtt min/avg/max/mdev = 0.056/0.160/0.363/0.143 ms

# 외부 인터넷 연결 되는지 확인하기

ip netns exec red ping 8.8.8.8
# ping: connect: Network is unreachable

ip a add 10.16.0.1/24 dev br0
ip netns exec red ip route add 0.0.0.0/0 via 10.16.0.1 dev veth1-red
ip route
# default via 10.16.0.1 dev veth1-red 
# 10.16.0.0/24 dev veth1-red proto kernel scope link src 10.16.0.2

ping 10.16.0.1 -c 2
# PING 10.16.0.1 (10.16.0.1) 56(84) bytes of data.
# 64 bytes from 10.16.0.1: icmp_seq=1 ttl=64 time=1.24 ms
# 64 bytes from 10.16.0.1: icmp_seq=2 ttl=64 time=0.062 m

iptables -I NAVY 2 -o br0 -j ACCEPT

ping 8.8.8.8 -c 2
# PING 8.8.8.8 (8.8.8.8) 56(84) bytes of data.
# 64 bytes from 8.8.8.8: icmp_seq=27 ttl=119 time=27.6 ms
# 64 bytes from 8.8.8.8: icmp_seq=28 ttl=119 time=27.7 ms

# 안됨. 그러면 NAT 테이블의 MASQUERRADE에 행을 추가해야함
# 그리고 브릿지를 통신할 수 있게 켜줌
# ipv4 포워드 설정을 켜줘야함.
# netns 내부에서 dns resolve 설정 해줘야함 (dns안쓰면 상관은 없음)

```

### 목표 시나리오 정의


### 1. NetNS 및 Veth, Bridge 생성


### 2. Veth을 각 NetNS와 Bridge에 연결


### 3. Bridge 및 각 NetNS의 네트워크 인터페이스 설정


### 4. 통신 확인