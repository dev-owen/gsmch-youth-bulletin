export type ChurchEvent = { title: string; date: string; endDate?: string; content: string; contact: string };
export type SiteInfo = {
  churchName: string; worshipTime: string; gatheringTime: string; introduction: string;
  vision: string; address: string; mapUrl: string; recurringInfo?: Partial<RecurringInfo>; churchEvents: ChurchEvent[];
};

export type DirectoryGroup = { title: string; entries: string[] };
export type RecurringInfo = {
  offering: {
    bank: string; accountNumber: string; accountHolder: string;
    envelope: string; transfer: string; example: string; mainChurch: string;
  };
  meetings: { title: string; schedule: string; location: string; description: string; contact: string }[];
  newcomer: { welcome: string; guidance: string };
  visionReference: string;
  visionPoints: { title: string; body: string; reference: string }[];
  missionGroups: DirectoryGroup[];
  missionNote: string;
  staffGroups: DirectoryGroup[];
};

// 사용자가 제공한 2026-11-05 주보 사진의 상시 안내. 관리자 저장값이 있으면 우선합니다.
export const defaultRecurringInfo: RecurringInfo = {
  offering: {
    bank: '새마을금고', accountNumber: '3560-09-008436-8', accountHolder: '선한목자교회',
    envelope: '동명이인 확인을 위해 교적번호, 또래, 이름을 모두 기재해 주세요.',
    transfer: '인터넷뱅킹·모바일뱅킹 송금 시 교적번호와 헌금종류만 순서대로 기입해 주세요. 부득이하게 미입력 시에는 헌금봉투에 입금 영수증을 넣고 교적번호와 헌금종류를 써서 헌금함에 넣어 주세요.',
    example: '십일조: 12345십',
    mainChurch: '본교회 예배를 드리고 젊은이교회에 헌금하시는 지체는 헌금봉투에 본인의 또래나 “젊은이교회”를 기입해 주세요.',
  },
  meetings: [
    { title: '주일중보기도모임', schedule: '주일 오후 2:00', location: '마가다락방 중보기도실',
      description: '하나님 나라와 의를 구하며 열방, 나라, 젊은이예배를 위해 함께 기도합니다.', contact: '' },
    { title: '화요중보기도모임', schedule: '화요일 오후 8:00', location: '본당 지하 1층 샬롬홀',
      description: '예수님을 닮고 싶은 사람들을 위한 기도\n1. 하나님 아버지의 사랑을 묵상하는 기도\n2. 기도의 자리로 나아가는 기도\n3. 하나님의 자녀답게 살기를 결단하는 기도', contact: '' },
    { title: '노방전도모임', schedule: '주일 오후 12:00 · 토요일 오후 1:30', location: '코이노리 LAB 3실',
      description: '11월 일정: 주일 11/1 · 토요일 11/14, 11/21, 11/28', contact: '전도팀장 강유빈 (010-2692-4132)' },
  ],
  newcomer: {
    welcome: '젊은이교회를 찾아주신 새가족 여러분을 진심으로 환영합니다!',
    guidance: '예배 후 6층 글로리홀과 지하 1층 샬롬홀 엘리베이터 입구에서 각각 새가족 안내를 받으실 수 있습니다.',
  },
  visionReference: '로마서 12:2 · 에베소서 5:10',
  visionPoints: [
    { title: '예배', body: '예수님과 동행하며 영과 진리로 삶의 예배를 드립니다.', reference: '요한복음 4:23–24' },
    { title: '공동체', body: '예수님이 사랑하신 것처럼 서로 나누고 섬기는 공동체입니다.', reference: '요한복음 13:34–35' },
    { title: '선교', body: '성령의 능력으로 선교하며 하나님의 나라를 세웁니다.', reference: '사도행전 1:8' },
  ],
  missionGroups: [
    { title: '섬기는 교회', entries: ['선한사마리아인교회', '둘로스교회 · 임은희, 심예선 (형제교회)'] },
    { title: '선교기관', entries: ['학원복음화협의회', '하늘꿈중고등학교', '성남 C.C.C', '선교한국', '현대종교', 'WMC'] },
    { title: '국내 사역자', entries: ['김은희 목사 · 하늘꿈중고등학교', '김희진 목사 · C.C.C', '임산호 간사 · C.C.C'] },
    { title: '파송선교사', entries: ['김보명 · 일본', '염기창 · 대만', '임평화 · 필리핀', '김태완 · 인도네시아', '방게라 조니 · 인도'] },
    { title: '협력선교사', entries: ['주영광 · CAN', '유재국 · 인도네시아', '장안 · CAN', '조성현 · 태국', '임하리 · CAN'] },
    { title: '인턴선교사', entries: ['장성은 · 캄보디아', '헵시바 · CAN'] },
  ],
  missionNote: 'CAN (Creative Access Nations): 창의적 접근지역',
  staffGroups: [
    { title: '목회자', entries: ['담임목사 | 김다위', '담당목사 | 김찬숙 (느헤미야) · 정재영 (여호수아, 니르)', '협동목사 | 김희진'] },
    { title: '교역자', entries: ['전도사 | 한영광 (목회기획, 비전연구소, 해외선교)', '전도사 | 강진희 (샤인, 국내선교)', '목사 | 김민재 (하모니, 예배, 믿음의모험)', '전도사 | 이영광 (목양수석, 멜로디, 유학생, 카페코이노리)', '전도사 | 전희경 (조이, 드림프로젝트)', '전도사 | 박하나 (봉사, 멘토, 중보기도)'] },
    { title: '행정간사', entries: ['재정·사무행정 | 김기홍', '미디어 | 임소연', '목회행정 | 민경원'] },
    { title: '기획위원·사역팀', entries: ['기획위원 대표 (느헤미야·여호수아) | 임현선 · 고현정', '예배팀 | 문슬기 · 이은혜', '제자팀 | 원지연 · 김수빈', '국내선교팀 | 오원종 · 이보라', '해외선교팀 | 이지은 · 신민철', '봉사팀 | 홍수연 · 박재찬', '중보기도팀 | 김시랑 · 김민규', '새가족팀 | 홍연재 · 강민승', '미디어팀 | 김찬영 · 김희서', '재정팀 | 김선아 · 허예지', '믿음의모험팀 | 엄지윤 · 김민석', '셀대표 | 오혜린 · 이준혁'] },
  ],
};

export function normalizeSiteInfo(info: SiteInfo): SiteInfo & { recurringInfo: RecurringInfo } {
  const saved = info.recurringInfo;
  return {
    ...info,
    churchEvents: info.churchEvents || [],
    introduction: info.introduction || '젊은이교회는 예수님이 이끄심에 따라 젊은이들이 의사결정과 재정운영을 하는 기독교대한감리회 선한목자교회 내의 독립교회입니다.',
    vision: info.vision || '젊은이교회는 하나님의 기쁘신 뜻을 세상 가운데 행하는 교회입니다.',
    recurringInfo: {
      ...defaultRecurringInfo, ...saved,
      offering: { ...defaultRecurringInfo.offering, ...saved?.offering },
      newcomer: { ...defaultRecurringInfo.newcomer, ...saved?.newcomer },
    },
  };
}
