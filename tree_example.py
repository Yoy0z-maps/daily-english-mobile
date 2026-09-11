'''
이전 트리를 표현한 리스트 nodes를 인자로 받는다. 해당 이진 트리에 대하여
전위 / 중위 / 후위 순회 결과를 반환하는 solution()함수를 구현해라

- 입력 노드값의 개수는 1개 이상 1000개 이하이다
- 노드값은 정수형이며, 중복되지 않는다

Example
nodes: [1,2,3,4,5,6,7]
return: ["1 2 4 5 3 6 7", "4 2 5 1 6 3 7", "4 5 2 6 7 3 1"]
'''
def preorder(nodes, idx, target):
    if idx >= len(nodes):
        return

    # 중심노드
    target.append(nodes[idx]) # nodes[0] => 즉 중심 노드 0 추가
    # 왼쪽자식
    # 1. preorder(nodes, 0 * 2 + 1, target) : preorder(nodes, 1, target)
    # 2. preorder(nodes, 1 * 2 + 1, target) : preorder(nodes, 3, target)
    # 3. preorder(nodes, 3 * 2 + 1, target) : preorder(nodes, 7, target) return 여기까지 값 "1 2 4"하고 밑에 줄이 실행 안되서 넘어감
    # 4. preorder(nodes, 3 * 2 + 2, target) : preorder(nodes, 8, target) => return
    # 5. preorder(nodes, 1 * 2 + 2, target) : preorder(nodes, 4, target) => "1 2 4 5"
    preorder(nodes, idx * 2 + 1, target)
    # 오른쪽자식
    # 6. preorder(nodex, 0 * 2 + 2, target): preorider(nodex, 2, target) => "1 2 4 5 3"
    # 7. preorder(nodex, 2 * 2 + 1, target) : preorder(nodes, 5, target) => "1 2 4 5 3 6"
    # 8. preorder(nodex, 2 * 2 + 2, target) : preorder(nodes, 6, target) => "1 2 4 5 3 6 7"
    preorder(nodes, idx * 2 + 2, target) 

    return target

def inorder(nodes, idx, target):
    if idx >= len(nodes):
        return
    # 1. inorder(nodes, 0 * 2 + 1, target), inorder(nodes, 1, target)
    # 2. inorder(nodes, 1 * 2 + 1, target), inorder(nodes, 3, target)
    # 3. inorder(nodes, 3 * 2 + 1, target), inorder(nodes, 7, target) return
    # 4. target.append(3)
    # 5. inorder(nodex, 8, target) return으로 # 3 종료
    # 6. target.append(1)
    # 5. inorder(nodes, 4, target)
    # 6. target.append(4) idx = 4일 때 inorder(nodes, idx * 2 + 1, target), inorder(nodes, idx * 2 + 2, target) 전부 return으로로 # 2 종료
    inorder(nodes, idx * 2 + 1, target)
    # 7. target.append(0) "4 2 5 1"
    target.append(nodes[idx])
    # 8. inorder(nodes, 0 * 2 + 2, target), inorder(nodes, 2, target)
    # 9. inorder(nodes, 2 * 2 + 1, target), inorder(nodex, 5, target)
    # 10. inorder(nodes, 5 * 2 + 1, target) 초과로 종료
    # 11. target.append(5)
    # 12. inorder(nodes, 5 * 2 + 2, target) 초과로 종료
    # 13. target.append(2)
    # 14. inorder(nodes, 2 * 2 + 2, target), inorder(nodes, 6, target)
    # 14. inorder(nodes, 6 * 2 + 1, target) 초과로 종료
    # 15. target.append(6) "4 2 5 1 6 3 7"
    # 16.  inorder(nodes, 6 * 2 + 2, target) 초과로 종료
    inorder(nodes, idx * 2 + 2, target)
    return target

def postorder(nodes, idx, target):
    if idx >= len(nodes):
            return

    inorder(nodes, idx * 2 + 1, target)
    inorder(nodes, idx * 2 + 2, target)
    target.append(nodes[idx])

    return target


def solution(nodes):
    answer = []
    preorder_result = []
    inorder_result = []
    postorder_result = []

    answer.append(preorder(nodes, 0, preorder_result))
    answer.append(inorder(nodes, 0, inorder_result))
    answer.append(postorder(nodes, 0, postorder_result))

    return answer

print(solution([1,2,3,4,5,6,7]))

'''
응. 셋 다 단순히 시험용으로 있는 게 아니라 **“부모를 언제 처리해야 하는가?”**에 따라 실제 용도가 달라져.

예를 들어 이 트리로 생각해보자.

        4
      /   \
     2     6
    / \   / \
   1   3 5   7

순회	순서	대표적인 용도
전위	부모 → 왼쪽 → 오른쪽	트리 복사/직렬화, 구조를 위에서부터 처리
중위	왼쪽 → 부모 → 오른쪽	BST를 정렬된 순서로 조회
후위	왼쪽 → 오른쪽 → 부모	삭제, 계산 등 자식을 먼저 처리해야 할 때

전위 — 부모를 먼저 알아야 할 때

4 → 2 → 1 → 3 → 6 → 5 → 7

부모를 자식보다 먼저 처리해.

그래서 위에서부터 구조를 만들어 내려가는 작업과 잘 맞아. 예를 들어 트리 구조를 저장하거나 복사할 때 사용할 수 있어.

쉽게 기억하면:

부모부터 처리해야 한다 → 전위

중위 — BST에서 정렬된 값이 필요할 때

BST에서는

왼쪽 < 부모 < 오른쪽

이므로 중위:

왼쪽 → 부모 → 오른쪽

로 읽으면

1 → 2 → 3 → 4 → 5 → 6 → 7

처럼 오름차순으로 나온다.

그래서 BST에서 정렬된 데이터를 얻는 게 중위 순회의 대표적인 용도야.

BST + 오름차순 → 중위

참고로 이 특성은 일반 이진 트리가 아니라 BST이기 때문에 성립해.

후위 — 자식을 먼저 끝내야 할 때

1 → 3 → 2 → 5 → 7 → 6 → 4

부모 4가 맨 마지막이야.

즉,

자식 처리
↓
자식 처리
↓
부모 처리

가 필요한 작업에 적합해.

대표적으로 트리 삭제가 있어.

        A
       / \
      B   C

트리를 삭제한다고 생각하면 A부터 지워버리기보다는

B 삭제
C 삭제
A 삭제

처럼 자식부터 제거하는 게 자연스럽지. 그래서 후위 순회가 잘 맞아.

또 하위 결과를 계산해서 부모가 사용하는 문제에도 후위가 잘 맞아.

예를 들어 폴더 용량 계산:

        root
       /    \
     A       B
   30MB     50MB

root의 전체 용량을 계산하려면 A와 B의 용량을 먼저 알아야 하잖아.

A 계산
B 계산
→ root 계산

이것도 후위적인 사고방식이야.

그래서 코테에서는 용도를 이렇게 기억하면 충분해:

전위 = 부모 먼저 → 위에서 아래로
중위 = 부모 중간 → BST 정렬 조회
후위 = 부모 마지막 → 아래에서 계산해서 위로 올리기

특히 앞으로 트리 문제를 풀다 보면 **“각 자식의 결과를 구한 다음 현재 노드의 답을 계산한다”**라는 문제가 엄청 많이 나오는데, 이런 문제들은 사실 이름을 후위 순회라고 명시하지 않아도 구조적으로 후위 순회를 사용하고 있는 경우가 많아.
'''

'''
첫번째 인수 lst를 활용하여 이진 탐색 트리를 생성하고, 두번째 인수 search_lst에 있는
각 노드를 이진 탐색 트리에서 찾을 수 있는지 확인하여 True / False를 담은 리스트를 반환하는 함수 solution() 구현

- lst 노드는 정수로 이루어져있으며 1000000개를 초과하지 않습니다
- 이진 탐색 트리의 삽입과 탐색 기능을 구현해야합니다
- search_1st의 길이는 10 이하입니다

Example
lst [5,3,8,4,2,1,7,10] [1,3,5,7,9]
search_lst [1,2,5,6] [2,4,6,8,10]
answer [True, True, True, False] [False, False, False, False, False]
''' 