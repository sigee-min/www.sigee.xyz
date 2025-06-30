---
title: (1) 리눅스 네트워크 찍먹하기
published: 2025-06-29
tags: [Linux, System]
category: DEV
# image: ./cover.png
draft: true
---

## 시리즈 배경

군 복무 중 깊이 있는 학습 주제를 고민하게 되었다. 책을 통한 이론 학습도 의미 있지만, `code-server`를 활용하면 군부대 PC방(사지방)에서도 원격 리눅스 환경에 접속하여 실습을 진행할 수 있다.

이러한 환경을 바탕으로, 이론으로만 접했던 리눅스 네트워크 개념을 직접 실습하며 정리해보고자 한다. 리눅스는 다양한 네트워크 도구를 지원하므로, 이를 이용해 가상 네트워크 환경을 구성하고 실험을 진행하는 것이 가능하다.

실제로 Docker 컨테이너나 Kubernetes Pod의 네트워크는 이러한 리눅스 기능을 기반으로 구현된다. 따라서 이 과정을 학습하면 해당 기술의 내부 동작 원리를 더 깊이 이해하는 데 큰 도움이 될 것이다.

이 시리즈는 개념의 상세한 설명보다는 실습을 통한 이해에 중점을 둔다. 이미 훌륭한 레퍼런스가 많이 존재하므로, 이론적 배경은 해당 자료들을 참고하는 것을 권장한다. 실습 과정에서 마주하는 개념을 직접 찾아보며 학습하는 것이 지식을 내재화하는 데 더 효과적일 것이다.

## 시나리오 - Network Namespace간 bridge를 통한 통신 구현

```bash
ip netns add red
ip netns add blue
```

결과 확인:
```bash
ip netns show
# red
# blue
```

```bash
ip link add veth-red type veth peer name veth-blue
ip link ls | grep veth
12: veth-blue@veth-red: <BROADCAST,MULTICAST,M-DOWN> mtu 1500 qdisc noop state DOWN mode DEFAULT group default qlen 1000
13: veth-red@veth-blue: <BROADCAST,MULTICAST,M-DOWN> mtu 1500 qdisc noop state DOWN mode DEFAULT group default qlen 1000
```

```bash
ip link set veth-blue netns blue
ip link set veth-red netns red

ip netns exec red ip link set veth-red up
ip netns exec blue ip link set veth-blue up
ip netns exec red ip link set lo up
ip netns exec blue ip link set lo up

ip netns exec red ip a add 10.16.0.2/24 dev veth-red

ip netns exec blue ip a add 10.16.0.3/24 dev veth-blue

ip netns exec red ip a
1: lo: <LOOPBACK,UP,LOWER_UP> mtu 65536 qdisc noqueue state UNKNOWN group default qlen 1000
    link/loopback 00:00:00:00:00:00 brd 00:00:00:00:00:00
    inet 127.0.0.1/8 scope host lo
       valid_lft forever preferred_lft forever
    inet6 ::1/128 scope host 
       valid_lft forever preferred_lft forever
13: veth-red@if12: <BROADCAST,MULTICAST,UP,LOWER_UP> mtu 1500 qdisc noqueue state UP group default qlen 1000
    link/ether 16:c8:bb:1a:a0:d7 brd ff:ff:ff:ff:ff:ff link-netns blue
    inet 10.16.0.2/24 scope global veth-red
       valid_lft forever preferred_lft forever
    inet6 fe80::14c8:bbff:fe1a:a0d7/64 scope link 
       valid_lft forever preferred_lft forever

ip netns exec blue ip a
1: lo: <LOOPBACK,UP,LOWER_UP> mtu 65536 qdisc noqueue state UNKNOWN group default qlen 1000
    link/loopback 00:00:00:00:00:00 brd 00:00:00:00:00:00
    inet 127.0.0.1/8 scope host lo
       valid_lft forever preferred_lft forever
    inet6 ::1/128 scope host 
       valid_lft forever preferred_lft forever
12: veth-blue@if13: <BROADCAST,MULTICAST,UP,LOWER_UP> mtu 1500 qdisc noqueue state UP group default qlen 1000
    link/ether 4e:88:d2:1a:cc:d0 brd ff:ff:ff:ff:ff:ff link-netns red
    inet 10.16.0.3/24 scope global veth-blue
       valid_lft forever preferred_lft forever
    inet6 fe80::4c88:d2ff:fe1a:ccd0/64 scope link 
       valid_lft forever preferred_lft forever

ip netns exec red ping 10.16.0.3
PING 10.16.0.3 (10.16.0.3) 56(84) bytes of data.
64 bytes from 10.16.0.3: icmp_seq=1 ttl=64 time=0.039 ms
64 bytes from 10.16.0.3: icmp_seq=2 ttl=64 time=0.048 ms
```

===


```bash
ip netns exec red ip link set veth1-red up
ip netns exec blue ip link set veth1-blue up

ip netns exec red ip a add 10.16.0.2/24 dev veth1-red

ip netns exec blue ip a add 10.16.0.3/24 dev veth1-blue

ip link set veth0-red up
ip link set veth0-blue up
ip link set br0 up

ip netns exec red ping 10.16.0.3 
PING 10.16.0.3 (10.16.0.3) 56(84) bytes of data.
64 bytes from 10.16.0.3: icmp_seq=1 ttl=64 time=0.204 ms
64 bytes from 10.16.0.3: icmp_seq=2 ttl=64 time=0.062 ms
```

> br_netfilter 활성화되어 있는 경우 해당 기능을 비활성화 해줘야한다. 예) sudo sysctl -w net.bridge.bridge-nf-call-iptables=0


===

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