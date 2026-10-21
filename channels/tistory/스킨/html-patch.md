# 티스토리 스킨 HTML 수정 (3곳)

**꾸미기 → 스킨 편집 → html 편집**에서 아래 세 곳만 고칩니다. 나머지는 건드리지 않습니다.
고치기 전에 **원래 HTML과 CSS 전체를 메모장에 복사해 백업**해 두세요.

---

## 1. `<head>` — 글꼴 추가

`<link rel="stylesheet" href="./style.css" />` **바로 위**에 붙여 넣습니다.
(CSS 파일 끝에서는 `@import` 가 먹지 않아 HTML에서 불러옵니다.)

```html
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Gowun+Batang:wght@400;700&display=swap" rel="stylesheet">
```

---

## 2. 상단 메뉴 — `<nav>` 통째로 교체

찾을 곳:

```html
            <!-- area-gnb -->
            <div class="area-gnb">
              <nav class="[##_var_topnav_##]">
                [##_blog_menu_##]
              </nav>
            </div>
```

이걸 아래로 바꿉니다.

```html
            <!-- area-gnb -->
            <div class="area-gnb">
              <nav class="topnavmenu">
                <ul>
                  <li><a href="/">홈</a></li>
                  <li><a href="/category/받아쓰기·맞춤법">받아쓰기·맞춤법</a></li>
                  <li><a href="/category/학습 자료">학습 자료</a></li>
                  <li><a href="/category/서비스">서비스</a></li>
                  <li><a href="/pages/about">소개</a></li>
                </ul>
              </nav>
            </div>
```

- 카테고리 이름은 **관리 화면의 카테고리 이름과 글자 하나까지 같아야** 합니다(띄어쓰기, 가운뎃점 포함).
- `소개`는 콘텐츠 → 페이지 관리에서 만든 소개 페이지의 주소가 `about` 일 때 맞습니다. 다른 주소로 만들었다면 `/pages/` 뒤를 그 주소로 바꾸세요.
- 이렇게 직접 적으면 관리 화면에서 메뉴를 고치는 방식은 더 이상 쓰이지 않습니다. 메뉴를 바꿀 일이 있으면 이 `<li>` 줄만 고치면 됩니다.

---

## 3. 홈 소개 카드 추가

찾을 곳: `<!-- container -->` 라는 주석이 있는 줄(`<div id="container">` 바로 위). 그 **바로 위**에 붙여 넣습니다.

```html
      <!-- 홈 소개 카드 (홈 화면에서만 보임) -->
      <section class="hero-intro">
        <div class="hero-card">
          <p class="hero-eyebrow">SIDE PROJECT WORKSHOP</p>
          <h2 class="hero-title">직접 만들고,<br><em>기록하면서</em> 키웁니다</h2>
          <p class="hero-desc">초등 받아쓰기·맞춤법 앱 ‘받아쓰기 공책’을 비롯해, 직접 만든 서비스와 만드는 과정을 모아 둡니다.</p>
          <div class="hero-actions">
            <a class="hero-btn hero-btn--primary" href="https://badasseugi.com/?utm_source=tistory&utm_medium=blog&utm_campaign=home_hero" target="_blank" rel="noopener">받아쓰기 공책 열어 보기</a>
            <a class="hero-btn" href="/category/받아쓰기·맞춤법">학습 팁 보기</a>
          </div>
        </div>
      </section>
      <!-- // 홈 소개 카드 -->
```

---

## 4. CSS

**꾸미기 → 스킨 편집 → CSS(style.css)** 의 **맨 아래**에 `custom.css` 내용 전체를 이어 붙입니다.

---

## 글 끝 CTA 상자 쓰는 법

글쓰기 화면에서 **기본모드 → HTML**로 바꾼 뒤 글 맨 끝에 붙여 넣습니다.

```html
<div class="cta-box">
  <strong>직접 풀어 보면 아이가 어디서 막히는지 바로 보여요</strong>
  <p>글로 읽는 것보다 실제로 써 보면 어떤 받침이 어려운지 확인하기 쉽습니다.</p>
  <a class="cta-btn" href="https://badasseugi.com/?utm_source=tistory&utm_medium=blog&utm_campaign=글주소" target="_blank" rel="noopener">‘받아쓰기 공책’에서 해 보기 →</a>
</div>
```

`utm_campaign=` 뒤에는 그 글의 주소(슬러그)를 넣으면 어느 글에서 눌렀는지 구분됩니다.
