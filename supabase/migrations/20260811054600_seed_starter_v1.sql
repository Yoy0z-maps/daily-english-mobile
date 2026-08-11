begin;

insert into public.content_releases (
  release_key,
  title,
  kind,
  status,
  planned_count,
  published_at
)
values (
  'starter-v1',
  'Starter Course v1',
  'starter',
  'published',
  20,
  '2026-01-01T00:00:00Z'
)
on conflict (release_key) do nothing;

insert into public.contents (
  content_index,
  sentence,
  normalized_sentence,
  meaning,
  keyword,
  keyword_meaning,
  example,
  example_meaning,
  level,
  category,
  intent_en,
  source,
  status,
  quality_score,
  release_id,
  release_position,
  published_at
)
select
  items.content_index,
  items.sentence,
  items.normalized_sentence,
  items.meaning,
  items.keyword,
  items.keyword_meaning,
  items.example,
  items.example_meaning,
  items.level,
  items.category,
  items.intent_en,
  'curated',
  'published'::public.content_status,
  90,
  r.id,
  items.content_index + 1,
  '2026-01-01T00:00:00Z'
from public.content_releases r
join (
  values
    (0, 'I''ll look into it.', 'i''ll look into it', '확인해볼게요.', 'look into', '조사하다 / 살펴보다', 'I''ll look into the issue and get back to you.', '그 문제를 확인해보고 다시 연락드릴게요.', 'B1', 'Daily', 'Promise to investigate or examine an issue.'),
    (1, 'I''m down for it.', 'i''m down for it', '저 좋아요 / 할게요.', 'be down for', '~할 의향이 있다', 'If everyone wants pizza, I''m down for it.', '다들 피자를 원하면 저도 좋아요.', 'B1', 'Daily', 'Express willingness or enthusiasm to participate.'),
    (2, 'I''ll get back to you.', 'i''ll get back to you', '다시 연락드릴게요.', 'get back to', '~에게 다시 연락하다', 'I''ll get back to you after I check my schedule.', '일정을 확인한 뒤 다시 연락드릴게요.', 'B1', 'Business', 'Promise to respond after checking information.'),
    (3, 'That works for me.', 'that works for me', '저는 괜찮아요.', 'work for', '~에게 괜찮다 / 맞다', 'Friday afternoon works for me.', '금요일 오후는 저는 괜찮아요.', 'A2', 'Business', 'Agree that a proposed plan or time is acceptable.'),
    (4, 'Could you walk me through it?', 'could you walk me through it', '그거 설명해주실 수 있나요?', 'walk through', '차근차근 설명하다', 'Could you walk me through the signup process?', '가입 절차를 차근차근 설명해주실 수 있나요?', 'B1', 'Developer', 'Ask someone to explain a process step by step.'),
    (5, 'Let''s circle back later.', 'let''s circle back later', '나중에 다시 이야기해요.', 'circle back', '다시 논의하다', 'Let''s circle back after the client responds.', '고객이 답변한 뒤 다시 이야기해요.', 'B2', 'Business', 'Suggest returning to a discussion at a later time.'),
    (6, 'I''m running a bit late.', 'i''m running a bit late', '저 조금 늦고 있어요.', 'run late', '늦다 / 지연되다', 'I''m running a bit late because of traffic.', '교통 때문에 조금 늦고 있어요.', 'A2', 'Daily', 'Notify someone that you will arrive slightly late.'),
    (7, 'Can I get this to go?', 'can i get this to go', '이거 포장해주실 수 있나요?', 'to go', '포장해서 가져가는', 'Can I get this coffee to go?', '이 커피 포장해주실 수 있나요?', 'A2', 'Travel', 'Ask for food or a drink to be packaged for takeaway.'),
    (8, 'I''m not following.', 'i''m not following', '제가 잘 이해를 못 했어요.', 'follow', '이해하다 / 따라가다', 'I''m not following the last part of your explanation.', '설명 마지막 부분을 잘 이해하지 못했어요.', 'B1', 'OPIc', 'Politely say that you do not understand an explanation.'),
    (9, 'Could you give me a quick heads-up?', 'could you give me a quick heads-up', '미리 간단히 알려주실 수 있나요?', 'heads-up', '사전 알림', 'Could you give me a quick heads-up before the meeting starts?', '회의가 시작되기 전에 미리 간단히 알려주실 수 있나요?', 'B2', 'Business', 'Ask someone to notify you briefly in advance.'),
    (10, 'I''ll take care of it.', 'i''ll take care of it', '제가 처리할게요.', 'take care of', '처리하다 / 돌보다', 'Don''t worry about the reservation. I''ll take care of it.', '예약은 걱정하지 마세요. 제가 처리할게요.', 'B1', 'Daily', 'Take responsibility for handling a task or problem.'),
    (11, 'Is there a workaround?', 'is there a workaround', '우회 방법이 있나요?', 'workaround', '임시 해결책 / 우회 방법', 'Is there a workaround until the patch is released?', '패치가 배포될 때까지 쓸 우회 방법이 있나요?', 'B2', 'Developer', 'Ask whether an alternative temporary solution exists.'),
    (12, 'The app keeps crashing.', 'the app keeps crashing', '앱이 계속 꺼져요.', 'keep -ing', '계속 ~하다', 'The app keeps crashing whenever I upload a photo.', '사진을 업로드할 때마다 앱이 계속 꺼져요.', 'B1', 'Developer', 'Report that an application repeatedly stops unexpectedly.'),
    (13, 'Could I switch rooms?', 'could i switch rooms', '방을 바꿀 수 있을까요?', 'switch', '바꾸다 / 전환하다', 'Could I switch rooms? This one is a bit noisy.', '방을 바꿀 수 있을까요? 이 방은 조금 시끄러워요.', 'B1', 'Travel', 'Politely ask to change to a different room.'),
    (14, 'I''m here for pickup.', 'i''m here for pickup', '픽업하러 왔어요.', 'pickup', '수령 / 픽업', 'Hi, I''m here for pickup under the name John.', '안녕하세요, John 이름으로 픽업하러 왔어요.', 'A2', 'Travel', 'Say that you have arrived to collect an order.'),
    (15, 'It depends on the situation.', 'it depends on the situation', '상황에 따라 달라요.', 'depend on', '~에 달려 있다', 'For me, it depends on the situation and the people involved.', '저에게는 상황과 관련된 사람들에 따라 달라요.', 'B1', 'OPIc', 'Explain that an answer varies according to circumstances.'),
    (16, 'I usually unwind by taking a walk.', 'i usually unwind by taking a walk', '저는 보통 산책하면서 긴장을 풀어요.', 'unwind', '긴장을 풀다', 'After work, I usually unwind by taking a walk near my apartment.', '퇴근 후에는 보통 집 근처를 산책하면서 긴장을 풀어요.', 'B2', 'OPIc', 'Describe a usual way of relaxing after stress.'),
    (17, 'Can we push the deadline back?', 'can we push the deadline back', '마감일을 미룰 수 있을까요?', 'push back', '미루다 / 연기하다', 'Can we push the deadline back by two days?', '마감일을 이틀 미룰 수 있을까요?', 'B2', 'Business', 'Ask to postpone a deadline to a later date.'),
    (18, 'The fix is ready for review.', 'the fix is ready for review', '수정 사항이 리뷰 준비됐어요.', 'ready for review', '검토할 준비가 된', 'The fix is ready for review, and I left notes in the PR.', '수정 사항이 리뷰 준비됐고 PR에 메모를 남겼어요.', 'B2', 'Developer', 'Tell collaborators that a software fix can now be reviewed.'),
    (19, 'I''d like to make a reservation.', 'i''d like to make a reservation', '예약하고 싶어요.', 'make a reservation', '예약하다', 'I''d like to make a reservation for two at seven.', '7시에 두 명 예약하고 싶어요.', 'A2', 'Travel', 'Politely request to book a table, room, or service.')
) as items(
  content_index,
  sentence,
  normalized_sentence,
  meaning,
  keyword,
  keyword_meaning,
  example,
  example_meaning,
  level,
  category,
  intent_en
) on true
where r.release_key = 'starter-v1'
on conflict (content_index) do nothing;

commit;
