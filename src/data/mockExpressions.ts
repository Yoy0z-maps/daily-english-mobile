import type { EnglishExpression } from '@/types/expression';

export const mockExpressions: EnglishExpression[] = [
  {
    id: 0,
    sentence: "I'll look into it.",
    meaning: '확인해볼게요.',
    keyword: 'look into',
    keywordMeaning: '조사하다 / 살펴보다',
    example: "I'll look into the issue and get back to you.",
    exampleMeaning: '그 문제를 확인해보고 다시 연락드릴게요.',
    level: 'B1',
    category: 'Daily'
  },
  {
    id: 1,
    sentence: "I'm down for it.",
    meaning: '저 좋아요 / 할게요.',
    keyword: 'be down for',
    keywordMeaning: '~할 의향이 있다',
    example: "If everyone wants pizza, I'm down for it.",
    exampleMeaning: '다들 피자를 원하면 저도 좋아요.',
    level: 'B1',
    category: 'Daily'
  },
  {
    id: 2,
    sentence: "I'll get back to you.",
    meaning: '다시 연락드릴게요.',
    keyword: 'get back to',
    keywordMeaning: '~에게 다시 연락하다',
    example: "I'll get back to you after I check my schedule.",
    exampleMeaning: '일정을 확인한 뒤 다시 연락드릴게요.',
    level: 'B1',
    category: 'Business'
  },
  {
    id: 3,
    sentence: 'That works for me.',
    meaning: '저는 괜찮아요.',
    keyword: 'work for',
    keywordMeaning: '~에게 괜찮다 / 맞다',
    example: 'Friday afternoon works for me.',
    exampleMeaning: '금요일 오후는 저는 괜찮아요.',
    level: 'A2',
    category: 'Business'
  },
  {
    id: 4,
    sentence: 'Could you walk me through it?',
    meaning: '그거 설명해주실 수 있나요?',
    keyword: 'walk through',
    keywordMeaning: '차근차근 설명하다',
    example: 'Could you walk me through the signup process?',
    exampleMeaning: '가입 절차를 차근차근 설명해주실 수 있나요?',
    level: 'B1',
    category: 'Developer'
  },
  {
    id: 5,
    sentence: "Let's circle back later.",
    meaning: '나중에 다시 이야기해요.',
    keyword: 'circle back',
    keywordMeaning: '다시 논의하다',
    example: "Let's circle back after the client responds.",
    exampleMeaning: '고객이 답변한 뒤 다시 이야기해요.',
    level: 'B2',
    category: 'Business'
  },
  {
    id: 6,
    sentence: "I'm running a bit late.",
    meaning: '저 조금 늦고 있어요.',
    keyword: 'run late',
    keywordMeaning: '늦다 / 지연되다',
    example: "I'm running a bit late because of traffic.",
    exampleMeaning: '교통 때문에 조금 늦고 있어요.',
    level: 'A2',
    category: 'Daily'
  },
  {
    id: 7,
    sentence: 'Can I get this to go?',
    meaning: '이거 포장해주실 수 있나요?',
    keyword: 'to go',
    keywordMeaning: '포장해서 가져가는',
    example: 'Can I get this coffee to go?',
    exampleMeaning: '이 커피 포장해주실 수 있나요?',
    level: 'A2',
    category: 'Travel'
  },
  {
    id: 8,
    sentence: "I'm not following.",
    meaning: '제가 잘 이해를 못 했어요.',
    keyword: 'follow',
    keywordMeaning: '이해하다 / 따라가다',
    example: "I'm not following the last part of your explanation.",
    exampleMeaning: '설명 마지막 부분을 잘 이해하지 못했어요.',
    level: 'B1',
    category: 'OPIc'
  },
  {
    id: 9,
    sentence: 'Could you give me a quick heads-up?',
    meaning: '미리 간단히 알려주실 수 있나요?',
    keyword: 'heads-up',
    keywordMeaning: '사전 알림',
    example: 'Could you give me a quick heads-up before the meeting starts?',
    exampleMeaning: '회의가 시작되기 전에 미리 간단히 알려주실 수 있나요?',
    level: 'B2',
    category: 'Business'
  },
  {
    id: 10,
    sentence: "I'll take care of it.",
    meaning: '제가 처리할게요.',
    keyword: 'take care of',
    keywordMeaning: '처리하다 / 돌보다',
    example: "Don't worry about the reservation. I'll take care of it.",
    exampleMeaning: '예약은 걱정하지 마세요. 제가 처리할게요.',
    level: 'B1',
    category: 'Daily'
  },
  {
    id: 11,
    sentence: 'Is there a workaround?',
    meaning: '우회 방법이 있나요?',
    keyword: 'workaround',
    keywordMeaning: '임시 해결책 / 우회 방법',
    example: 'Is there a workaround until the patch is released?',
    exampleMeaning: '패치가 배포될 때까지 쓸 우회 방법이 있나요?',
    level: 'B2',
    category: 'Developer'
  },
  {
    id: 12,
    sentence: 'The app keeps crashing.',
    meaning: '앱이 계속 꺼져요.',
    keyword: 'keep -ing',
    keywordMeaning: '계속 ~하다',
    example: 'The app keeps crashing whenever I upload a photo.',
    exampleMeaning: '사진을 업로드할 때마다 앱이 계속 꺼져요.',
    level: 'B1',
    category: 'Developer'
  },
  {
    id: 13,
    sentence: 'Could I switch rooms?',
    meaning: '방을 바꿀 수 있을까요?',
    keyword: 'switch',
    keywordMeaning: '바꾸다 / 전환하다',
    example: 'Could I switch rooms? This one is a bit noisy.',
    exampleMeaning: '방을 바꿀 수 있을까요? 이 방은 조금 시끄러워요.',
    level: 'B1',
    category: 'Travel'
  },
  {
    id: 14,
    sentence: "I'm here for pickup.",
    meaning: '픽업하러 왔어요.',
    keyword: 'pickup',
    keywordMeaning: '수령 / 픽업',
    example: "Hi, I'm here for pickup under the name John.",
    exampleMeaning: '안녕하세요, John 이름으로 픽업하러 왔어요.',
    level: 'A2',
    category: 'Travel'
  },
  {
    id: 15,
    sentence: 'It depends on the situation.',
    meaning: '상황에 따라 달라요.',
    keyword: 'depend on',
    keywordMeaning: '~에 달려 있다',
    example: 'For me, it depends on the situation and the people involved.',
    exampleMeaning: '저에게는 상황과 관련된 사람들에 따라 달라요.',
    level: 'B1',
    category: 'OPIc'
  },
  {
    id: 16,
    sentence: 'I usually unwind by taking a walk.',
    meaning: '저는 보통 산책하면서 긴장을 풀어요.',
    keyword: 'unwind',
    keywordMeaning: '긴장을 풀다',
    example: 'After work, I usually unwind by taking a walk near my apartment.',
    exampleMeaning: '퇴근 후에는 보통 집 근처를 산책하면서 긴장을 풀어요.',
    level: 'B2',
    category: 'OPIc'
  },
  {
    id: 17,
    sentence: 'Can we push the deadline back?',
    meaning: '마감일을 미룰 수 있을까요?',
    keyword: 'push back',
    keywordMeaning: '미루다 / 연기하다',
    example: 'Can we push the deadline back by two days?',
    exampleMeaning: '마감일을 이틀 미룰 수 있을까요?',
    level: 'B2',
    category: 'Business'
  },
  {
    id: 18,
    sentence: 'The fix is ready for review.',
    meaning: '수정 사항이 리뷰 준비됐어요.',
    keyword: 'ready for review',
    keywordMeaning: '검토할 준비가 된',
    example: 'The fix is ready for review, and I left notes in the PR.',
    exampleMeaning: '수정 사항이 리뷰 준비됐고 PR에 메모를 남겼어요.',
    level: 'B2',
    category: 'Developer'
  },
  {
    id: 19,
    sentence: "I'd like to make a reservation.",
    meaning: '예약하고 싶어요.',
    keyword: 'make a reservation',
    keywordMeaning: '예약하다',
    example: "I'd like to make a reservation for two at seven.",
    exampleMeaning: '7시에 두 명 예약하고 싶어요.',
    level: 'A2',
    category: 'Travel'
  }
];
