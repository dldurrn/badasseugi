export const metadata = { title: '개인정보처리방침 · 받아쓰기 공책' };

/**
 * 개인정보처리방침.
 *
 * 만 14세 미만 아동의 개인정보를 처리할 때는 법정대리인 동의가 필요합니다.
 * 이 앱은 아이 실명을 받지 않고 보호자 계정으로만 가입받는 구조로
 * 수집 자체를 최소화했습니다.
 *
 * 아래 세 값은 고지 의무가 걸린 항목입니다.
 * 운영자나 연락처가 바뀌면 여기만 고치면 화면 전체에 반영됩니다.
 * 방침 내용을 고칠 때는 시행일도 함께 올려 주세요 —
 * 언제부터 적용되는 방침인지가 고지의 핵심입니다.
 */

const OPERATOR = '이영훈';
const CONTACT = 'lyhza@naver.com';
const EFFECTIVE_DATE = '시행일: 2026년 8월 19일';

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h2 className="mb-1.5 font-bold">{title}</h2>
      <div className="flex flex-col gap-2" style={{ color: 'var(--ink-soft)' }}>
        {children}
      </div>
    </section>
  );
}

export default function PrivacyPage() {
  return (
    <main className="page" style={{ paddingBottom: 60 }}>
      <h1 className="display mb-2 pt-4 text-2xl font-bold">개인정보처리방침</h1>
      <p className="mb-6 text-xs" style={{ color: 'var(--ink-faint)' }}>
        {EFFECTIVE_DATE}
      </p>

      <div className="flex flex-col gap-6 text-sm leading-relaxed">
        <Section title="한눈에 보기">
          <p>
            <b>아이의 실명·생년월일·연락처·사진은 수집하지 않습니다.</b> 아이는 보호자가 정한
            별명으로만 구분됩니다. 계정은 보호자 이메일(또는 카카오 계정)로만 만들 수 있고,
            아이는 따로 가입하지 않습니다. 광고에 쓰거나 제3자에게 팔지 않습니다.
          </p>
        </Section>

        <Section title="1. 수집하는 항목">
          <p>
            <b>보호자 계정</b> — 이메일 주소, 비밀번호(단방향 암호화되어 저장되며 운영자도 볼 수
            없습니다). 카카오로 로그인하면 카카오가 제공하는 계정 식별자와 이메일을 받습니다.
          </p>
          <p>
            <b>자녀 프로필</b> — 보호자가 정한 별명, 고른 그림, 프로필 잠금 번호(4자리, 해시로만
            저장). 실명이 아닌 별명을 쓰도록 안내하고 있으며 앱에는 실명을 적는 칸이 없습니다.
          </p>
          <p>
            <b>학습 기록</b> — 보호자가 등록한 받아쓰기 문장, 아이가 푼 결과(점수, 맞고 틀림, 오답
            문장, 오류 유형), 받은 배지와 카드.
          </p>
          <p>
            <b>자동 수집</b> — 로그인 상태와 선택한 프로필을 기억하기 위한 쿠키. 광고·추적
            목적의 쿠키는 사용하지 않습니다.
          </p>
        </Section>

        <Section title="2. 이용 목적">
          <p>
            로그인 유지, 아이별 학습 기록 저장, 오답노트와 리포트 제공에만 사용합니다. 광고,
            프로파일링, 자동화된 의사결정에 사용하지 않습니다.
          </p>
        </Section>

        <Section title="3. 보관 기간과 파기">
          <p>
            계정을 삭제하면 그 계정에 속한 자녀 프로필과 학습 기록이 함께 삭제됩니다. 앱에서 자녀
            프로필을 지우면 그 아이의 점수·오답노트·보상도 즉시 함께 삭제됩니다.
          </p>
          <p>문제지 사진은 문장을 뽑아내는 즉시 폐기하며 서버에 저장하지 않습니다.</p>
        </Section>

        <Section title="4. 제3자 제공">
          <p>이용자의 개인정보를 제3자에게 제공하지 않습니다.</p>
        </Section>

        <Section title="5. 처리 위탁 및 국외 이전">
          <p>서비스 운영을 위해 아래 업체의 인프라를 이용하며, 데이터가 국외에 저장될 수 있습니다.</p>
          <p>
            · <b>Supabase</b> — 계정 인증과 데이터베이스 보관
            <br />· <b>Vercel</b> — 웹 서비스 호스팅
            <br />· <b>Anthropic</b> — 문제지 사진에서 문장 추출(사진을 보내는 순간에만, 보관하지
            않음). 사진 인식 기능을 쓰지 않으면 전송되지 않습니다.
          </p>
        </Section>

        <Section title="6. 만 14세 미만 아동에 관한 사항">
          <p>
            이 서비스는 보호자가 가입하고 보호자가 자녀 프로필을 만드는 구조입니다. 아동은 직접
            가입할 수 없으며, 아동에게 실명·생년월일·연락처를 묻지 않습니다. 보호자는 언제든 자녀
            프로필과 그 기록 전체를 삭제할 수 있습니다.
          </p>
        </Section>

        <Section title="7. 이용자의 권리">
          <p>
            보호자는 자신과 자녀 프로필의 정보에 대해 열람·정정·삭제·처리정지를 요구할 수
            있습니다. 대부분은 앱 안에서 바로 할 수 있습니다 — 설정에서 프로필을 고치거나 지우고,
            아래 문의처로 연락하면 계정 전체 삭제를 요청할 수 있습니다.
          </p>
        </Section>

        <Section title="8. 안전조치">
          <p>
            비밀번호와 프로필 잠금 번호는 되돌릴 수 없는 형태로만 저장합니다. 데이터베이스는 계정
            단위 접근 제어(RLS)로 분리되어 다른 가족의 기록에 접근할 수 없습니다. 통신은 모두
            암호화(HTTPS)됩니다.
          </p>
        </Section>

        <Section title="9. 문의처">
          <p>
            개인정보 처리에 관한 문의는 아래로 보내 주세요.
            <br />
            운영자: {OPERATOR}
            <br />
            {/* 눌러서 바로 보낼 수 있게 — 문의처는 닿기 쉬워야 합니다 */}
            이메일:{' '}
            <a href={`mailto:${CONTACT}`} style={{ color: 'var(--grid-deep)' }}>
              {CONTACT}
            </a>
          </p>
          <p className="text-xs">
            개인정보 침해에 관한 상담이 필요하면 개인정보침해신고센터(privacy.kisa.or.kr, 국번없이
            118)에 문의할 수 있습니다.
          </p>
        </Section>

        <Section title="10. 방침 변경">
          <p>
            내용이 바뀌면 시행일 7일 전부터 앱 안에서 알립니다. 이용자에게 불리한 변경은 30일 전에
            알립니다.
          </p>
        </Section>
      </div>
    </main>
  );
}
