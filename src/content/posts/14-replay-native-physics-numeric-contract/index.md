---
title: "고정소수점 도입: (4)Replay Native Physics"
published: 2026-04-21
description: 부동소수점이 결정론을 흔드는 이유와, 고정소수점 계약이 재현 가능한 물리 시뮬레이션의 계산 조건이 되는 과정을 정리했다.
tags: [physics, simulation]
category: dev
image: ./cover.png
draft: false
---

## 계산 조건

내가 만들고 싶은 물리 시뮬레이션 환경은 장면을 한 번 돌리고 끝내는 쪽보다, 특정 지점으로 돌아가 다시 실험하는 쪽에 가깝다.
같은 상태에서 시작하고, 한두 조건만 바꾸고, 차이가 어디서 생겼는지 좁은 범위에서 보고 싶다.
CPU와 GPU에서도 같은 질문을 던지는 구조를 원한다.

이 목표를 잡으면 숫자가 바로 실험 조건이 된다.
위치, 속도, 힘, 충돌 깊이, 시간 간격은 전부 다음 tick의 입력이다.
한 tick에서 생긴 아주 작은 차이도 다음 tick으로 넘어가고, 충돌 판정이나 누적 impulse의 모양을 바꾼다.

게임 화면에서는 비슷해 보이는 장면도, 중간 지점부터 다시 열어 비교하려면 다른 장면이 된다.
그래서 여기서 말하는 재현성은 화면이 대충 같은 수준보다 훨씬 좁다.
같은 입력을 넣었을 때 같은 순서로 계산되고, 같은 반올림을 거쳐, 같은 비트 패턴으로 상태가 남는다.

숫자를 그냥 값으로 보면 이 요구가 과해 보인다.
컴퓨터 구조 쪽에서 보면 자연스러운 요구다.
컴퓨터는 실수를 그대로 보관하는 대신, 정해진 bit 안에서 숫자를 표현한다.
표현 방식이 달라지면 같은 수식도 다른 실행 결과를 낳는다.

## 부동소수점

부동소수점은 실수를 부호, 지수, 유효숫자로 나눠 저장하는 방식이다.
큰 값과 작은 값을 같은 형식으로 다루기 좋고, CPU와 GPU가 빠르게 처리한다.
그래서 그래픽스, 물리, 수치 계산에서 널리 쓰인다.

대신 모든 실수를 정확히 담기에는 bit 수가 정해져 있다.
`0.1` 같은 십진 소수도 이진 부동소수점 안에서는 근사값으로 저장된다.
계산할 때마다 결과는 다시 표현 가능한 값 중 하나로 반올림된다.

```text
부동소수점 값
  sign        : 부호
  exponent    : 크기 범위
  significand : 유효숫자

실제 값은 이 세 항목을 조합한 근사값이다.
```

IEEE 754 같은 표준은 이 표현과 반올림 규칙을 설명하는 공통 언어를 준다.
이 기반 덕분에 서로 다른 기계에서도 숫자 계산을 꽤 안정적으로 설명한다.

다만 물리 시뮬레이션의 replay 목표는 표준의 기본 보장보다 좁은 실행 범위를 요구한다.
같은 소스 코드가 같은 명령어 조합으로 내려가는지, 곱셈과 덧셈이 따로 실행되는지, fused multiply-add로 합쳐지는지, SIMD lane을 어떤 순서로 접는지는 별도의 실행 조건이다.
CPU와 GPU backend까지 같이 놓으면 이 차이는 더 잘 보인다.

## 결정론의 틈

부동소수점 덧셈은 교과서의 실수 덧셈과 달리 결합 순서의 영향을 받는다.
중간 결과가 매번 표현 가능한 값으로 반올림되기 때문이다.

```cpp
float a = 1e20f;
float b = -1e20f;
float c = 3.14f;

(a + b) + c  // c 근처
a + (b + c)  // 0 근처
```

위 예시는 버그라기보다 finite precision의 정상적인 결과다.
큰 값 옆에 작은 값을 더하면 작은 값이 표현 폭 밖으로 밀려난다.
계산 순서가 달라지면 사라지는 값도 달라진다.

물리 엔진에서는 이런 일이 더 자주 생긴다.
여러 constraint가 같은 body에 모이고, 병렬 작업이 결과를 합치고, solver가 같은 값을 여러 번 갱신한다.
컴파일러가 FMA를 쓰는지, backend가 reduction을 어떤 트리로 접는지, denormal 값을 그대로 둘지 flush할지도 결과에 영향을 준다.

```text
같은 식
  a * b + c

실행 A
  multiply
  round
  add
  round

실행 B
  fused multiply-add
  round
```

두 실행은 수학적으로 같은 식을 계산한다.
하지만 중간 반올림 횟수와 위치가 다르다.
일반적인 시뮬레이션에서는 이 차이를 오차 범위로 볼 때가 많다.
내가 만들려는 환경에서는 그 차이가 실험 조건의 일부가 된다.

특정 장면을 중간부터 다시 열고, 변경 전후를 비교하고, CPU와 GPU 결과를 같은 기준으로 읽으려면 숫자 계산의 여지를 더 좁힌다.
부동소수점 자체를 탓하는 쪽보다, 목표에 필요한 계산 모델을 따로 정하는 쪽이 맞았다.

## 고정소수점

고정소수점은 실수를 정수와 scale로 표현한다.
소수점 위치를 미리 정해두고, 실제 값 대신 정수 raw 값을 저장한다.
예를 들어 fractional bit를 `32`로 잡으면 raw integer `1 << 32`가 물리 값 `1.0`을 뜻한다.

```text
real value = raw / 2^32

raw = 4294967296
value = 1.0

raw = 2147483648
value = 0.5
```

덧셈과 뺄셈은 raw integer끼리 처리된다.
곱셈은 raw 값을 곱한 뒤 scale을 다시 맞춘다.

```text
add
  a.raw + b.raw

mul
  (a.raw * b.raw) >> 32
```

이 방식의 장점은 숫자 의미가 hardware의 부동소수점 mode에서 빠져나와 코드의 계약 안으로 들어온다는 데 있다.
정수 연산, 중간 폭, shift, overflow 처리, 반올림 위치를 직접 정하면 CPU와 GPU backend가 따라야 할 기준이 생긴다.

고정소수점 표현 뒤에도 계약이 남는다.
scale, rounding, overflow, division, accumulator 폭까지 같이 고정한다.
여기서부터 숫자는 자료형보다 계약에 가까워진다.

## 숫자 계약

내가 원하는 기반 코어에서는 상태를 확정하는 물리 값을 fixed-point raw integer로 둔다.
부동소수점은 입력 변환, 표시, 분석 보조 영역에 남겨두고, 상태를 확정하는 경로는 고정소수점 계약을 따른다.

계약은 대략 이런 모양이다.

```text
numeric contract
  representation : signed fixed-point
  raw type       : i64
  fraction bits  : 32
  multiply temp  : i128
  accumulate temp: i128
  rounding       : nearest, ties away from zero
  overflow       : saturate
  division       : widened numerator, explicit rounding
```

계약을 이렇게 적어두면 구현 기준이 생긴다.
어떤 연산이 계약 밖으로 나갔는지 바로 보인다.
compiler flag나 backend 옵션도 이 계약을 깨는지 여부로 판단한다.

## Scale과 Rounding

고정소수점 곱셈은 raw 값을 곱한 뒤 fractional bit만큼 다시 줄인다.
`Q32`라면 곱셈 결과를 `32`bit 오른쪽으로 민다.

```text
(a.raw * b.raw) >> 32
```

여기서 그냥 shift하면 0 방향에 가까운 절삭이 된다.
물리 엔진에서 이 절삭 규칙은 작은 bias가 된다.
solver가 같은 방향으로 수천 번 반복되면 bias도 누적된다.

그래서 rounding도 계약에 넣는다.
아래 코드는 예시다.
핵심은 `i128` 중간 값을 만들고, 부호별로 같은 규칙을 적용한 뒤, 마지막에 `i64` 범위로 접는다는 점이다.

```cpp
#include <cstdint>
#include <limits>

struct Fx {
  int64_t raw;
};

constexpr int kFracBits = 32;
constexpr __int128 kHalf = static_cast<__int128>(1) << (kFracBits - 1);

static int64_t saturate_i64(__int128 v) {
  const __int128 hi = std::numeric_limits<int64_t>::max();
  const __int128 lo = std::numeric_limits<int64_t>::min();

  if (v > hi) return std::numeric_limits<int64_t>::max();
  if (v < lo) return std::numeric_limits<int64_t>::min();
  return static_cast<int64_t>(v);
}

static __int128 round_shift_q32(__int128 v) {
  if (v >= 0) {
    return (v + kHalf) >> kFracBits;
  }

  return -(((-v) + kHalf) >> kFracBits);
}

static Fx mul(Fx a, Fx b) {
  const __int128 wide = static_cast<__int128>(a.raw) *
                        static_cast<__int128>(b.raw);
  return Fx{saturate_i64(round_shift_q32(wide))};
}
```

이 코드의 핵심은 빠른 곱셈보다 중간 폭, rounding, saturation이 함수 안에 고정돼 있다는 점이다.
물리 코드는 이 함수를 거쳐 숫자를 만들고, 상태 비교용 hash는 이 결과를 기준으로 삼는다.

## Overflow와 Accumulator

정수로 물리 값을 들고 가면 overflow가 바로 실행 계약의 일부가 된다.
C/C++에서는 signed integer overflow를 정상 계산 규칙으로 삼기 곤란하다.
컴파일러는 그런 경로를 전제로 최적화할 수 있고, 그 순간 replay 규칙이 코드 밖으로 밀린다.

그래서 overflow는 명시적으로 처리한다.
덧셈도 넓은 폭에서 한 번 받은 뒤 saturate한다.

```cpp
static Fx add(Fx a, Fx b) {
  const __int128 wide = static_cast<__int128>(a.raw) +
                        static_cast<__int128>(b.raw);
  return Fx{saturate_i64(wide)};
}
```

solver에서는 accumulator가 더 중요하다.
한 body에 여러 contact와 joint가 모이면 impulse가 계속 더해진다.
각 row마다 바로 `i64`로 접으면 순서에 따른 차이가 커진다.

그래서 accumulation 구간을 따로 본다.

```text
row impulse
  -> i128 accumulator
  -> 정해진 row 순서로 누적
  -> clamp
  -> 마지막에 i64 fixed-point로 commit
```

여기서 넓은 accumulator는 성능 비용을 만든다.
특히 GPU에서는 `i128` 자체가 자연스러운 연산 단위로 내려가는 경우가 드물다.
그 부담 때문에 매 프레임 경로 전체를 `i128`로 밀어붙이는 선택은 신중히 본다.

그래도 상태를 확정하는 commit 지점에는 같은 규칙이 필요하다.
wide 계산의 범위와 raw state로 접는 지점이 replay의 경계가 된다.

## CPU와 GPU의 접점

CPU와 GPU에서 같은 fixed-point 계약을 적용하려면 함수 하나를 맞추는 정도보다 범위가 넓다.
두 backend가 같은 데이터를 읽고, 같은 작업 단위로 나뉘고, 같은 순서로 결과를 접는 규칙을 공유한다.

특히 reduction이 중요하다.
병렬 처리에서는 여러 worker가 만든 값을 마지막에 합친다.
덧셈이 정수라 해도 overflow와 saturation이 들어오면 합치는 순서가 의미를 가진다.

```text
같은 입력 값

order A
  (((a + b) + c) + d)

order B
  ((a + c) + (b + d))

saturation 지점이 다르면 commit 값도 달라진다.
```

그래서 backend 최적화 전에 먼저 결과를 접는 트리를 고정한다.
GPU에서는 workgroup 내부 reduction, workgroup 간 merge, island별 commit 순서가 모두 계약의 일부가 된다.
CPU에서는 thread pool이 어떤 순서로 끝났는지보다, 결과 buffer를 어떤 key 순서로 읽어 commit하는지가 중요하다.

이 설계는 성능 최적화와도 연결된다.
3편에서 매 프레임 경로, 준비 경로, 디버그/생성 경로를 나눈 이유가 여기로 다시 이어진다.
매 프레임 경로에서는 새 할당을 줄이고, 준비 단계에서는 정렬된 작업과 workspace를 만들어둔다.
그 결과 매 프레임 경로는 정해진 배열을 정해진 순서로 읽고 쓴다.

숫자 계약과 실행 순서 계약은 같은 commit boundary를 공유한다.
같은 fixed-point 연산도 commit 순서가 달라지면 replay 기준이 흔들린다.

## 코드의 위치

이런 계약은 문서에만 있으면 금방 흐려진다.
코드 구조 안에 들어간다.

물리 상태를 갱신하는 쪽에서는 raw integer가 직접 돌아다니는 범위를 줄인다.
대신 의미 있는 타입을 둔다.

```cpp
struct Position {
  Fx x;
  Fx y;
  Fx z;
};

struct Velocity {
  Fx x;
  Fx y;
  Fx z;
};

struct Impulse {
  Fx x;
  Fx y;
  Fx z;
};
```

타입을 나누면 단위 실수도 줄어든다.
위치와 속도, impulse는 모두 fixed-point raw를 품지만, 물리 의미가 서로 다르다.
곱하는 값과 더하는 값이 달라진다.

계약은 primitive 함수에도 들어가고, solver boundary에도 들어간다.

```text
numeric primitive
  add
  sub
  mul
  div
  clamp

solver boundary
  row input build
  accumulator merge
  impulse clamp
  state commit
  state hash
```

이렇게 나누면 실험이 편해진다.
rounding 규칙을 바꾸는 실험, accumulator 폭을 바꾸는 실험, saturation 정책을 바꾸는 실험이 모두 같은 위치에서 이뤄진다.
AI가 중간 지점부터 코드를 바꿔 다시 돌리는 루프를 생각해도, 비교할 숫자 경계가 분명해진다.

## 마무리

아직은 멋진 데모보다 이런 지루한 계약만 계속 보고 있다.
그래도 이 부분을 초반에 잡아두니, 뒤에 작업을 쌓아갈 때 안정감이 조금 생긴다.

빨리 눈에 보이는 데모를 뽑고 싶은 마음은 계속 있는데, 아직 갈 길이 꽤 남았다.
그래도 성능과 기능이 붙는 게 조금씩 보인다.
전역 전까지는 그럴듯한 결과물이 나올 것 같다는 기대도 조금 생긴다.
