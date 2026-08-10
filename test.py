'''
def solution(prices):
    n = len(prices)
    answer = [0] * n
    stack = []
    # prices = [1,2,3,2,3]
    # i: 0, 1, 2, 3, 4
    # stack: [0], [0, 1], [0,1,2], prev=2 / answer[2] = 3 -2 = 1 [0,1,3,4]
    # price[i] < prices[[stack[-1]]: x, 2 < 1, 3 < 2, 2 < 3, 3 < 2
    # answer = [0,0,1,0,0]

    # prices = [1,2,1,0,0]
    # i: 0, 1, 2, 3, 4
    # stack: [0], [0, 1], prev = 1 / answer[1] = 2 - 1 = 1 [0,2], prev = 2 / answer[2] = 3 -2 = 1 => prev = 0 / answer[0] = 3 - 0 = 3 [3], [3, 4]
    # price[i] < prices[[stack[-1]]: x, 2 < 1, 1 < 2, 0 < 1 => 0 < 1, x
    # answer = [3,1,1,0,0]
    for i in range(n):
        while stack and prices[i] < prices[stack[-1]]: # ?
            prev = stack.pop() # prev = 2
            answer[prev] = i - prev # ?
        stack.append(i)
    # 가격 하락한 시점이 확정된 인덱스들을 제거
    # 인덱스를 스텍에 넣어서 이전 값과 비교 및 아직 답이 안 나온 인덱스 저장 (값이 나오는 인덱스의 경우, 기준 숫자 다음 턴의 숫자가 바로 작아질 때)

    while stack:
        prev = stack.pop()
        answer[prev] = n - 1 - prev

    return answer



print(solution([1,2,1,0,0]))
# print(solution([1,2,3,2,3]))
# print(solution([3,2,1]))
'''