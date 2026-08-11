# 상담신청 폼 자동 입력 — 세무법인 리치 쪽에 넣을 코드

보유세 계산기(`tax.rich-group.kr`)에서 「이 결과로 상담받기」를 누르면
상담신청 페이지로 보낼 때 **부동산 주소와 상담 내용을 주소창에 실어 보낸다.**
받는 쪽에서 그 값을 읽어 칸에 채우려면 아래 코드가 필요하다.

- 대상 페이지: `https://023339001.com/상담신청/`
- 폼: Formspree (`https://formspree.io/f/xwvyvrap`)

---

## 넣는 곳

워드프레스 해당 페이지 편집 → **폼 블록 아래에 「커스텀 HTML」 블록**을 하나
추가하고 아래를 그대로 붙여 넣는다.

(테마 footer 나 Code Snippets 플러그인에 넣어도 되지만, 이 페이지에만
필요한 코드라 페이지 안에 두는 편이 나중에 찾기 쉽다.)

---

## 코드

```html
<script>
(function () {
  'use strict';

  /*
   * 주소창에 실려 온 값으로 상담 폼을 미리 채운다.
   *
   * 채울 수 있는 칸만 허용 목록으로 둔다. 폼에 있는 이름을 아무거나 받아
   * 채우면, 나중에 칸이 늘었을 때 뜻하지 않은 곳까지 채워진다.
   *
   * `개인정보동의` 는 일부러 뺐다. 동의는 본인이 눌러야 하는 것이라
   * 링크로 미리 체크해 두면 안 된다.
   */
  var FILLABLE = ['성함', '연락처 또는 이메일주소', '부동산주소', '상담내용'];
  var CHECKABLE = ['상담주제'];

  function fill() {
    var form = document.querySelector('form[action*="formspree.io"]');
    if (!form) return false;

    var params = new URLSearchParams(window.location.search);

    FILLABLE.forEach(function (name) {
      var value = params.get(name);
      if (!value) return;
      var field = form.querySelector('[name="' + name + '"]');
      // 사용자가 이미 적어 넣은 값은 덮지 않는다.
      if (field && !field.value) field.value = value;
    });

    CHECKABLE.forEach(function (name) {
      var values = params.getAll(name);
      if (!values.length) return;
      var boxes = form.querySelectorAll('[name="' + name + '"]');
      Array.prototype.forEach.call(boxes, function (box) {
        if (values.indexOf(box.value) !== -1) box.checked = true;
      });
    });

    return true;
  }

  if (fill()) return;

  // 폼이 늦게 그려지는 경우가 있어 나타날 때까지 지켜본다.
  var observer = new MutationObserver(function () {
    if (fill()) observer.disconnect();
  });
  observer.observe(document.documentElement, { childList: true, subtree: true });

  // 그래도 못 찾으면 10초 뒤 포기한다 — 계속 지켜보면 페이지가 무거워진다.
  setTimeout(function () { observer.disconnect(); }, 10000);
})();
</script>
```

---

## 보내는 쪽 (계산기)이 만드는 링크

```
https://023339001.com/상담신청/
  ?부동산주소=서울 강남구 압구정동 397 압구정미성2차 21동 101호
  &상담내용=2026년 예상 보유세 2,214만원 (재산세 851만 · 종부세 1,363만)
  &상담주제=양도
```

실제로는 값이 URL 인코딩되어 한 줄로 붙는다.

---

## 확인 방법

주소창에 아래를 직접 쳐 보면 4번 칸이 채워져야 한다.

```
https://023339001.com/상담신청/?부동산주소=테스트주소123
```

- 4번 「상담받고자 하는 부동산 주소」에 `테스트주소123` 이 들어가면 성공
- 6번 개인정보 동의는 **체크되지 않아야 한다** (일부러 뺀 것)

---

## 안전 관련

- 값은 `element.value` 로만 넣는다. HTML 로 해석되지 않으므로 스크립트 주입이 안 된다
- 허용한 네 칸(+상담주제) 외에는 건드리지 않는다
- 사용자가 이미 입력한 칸은 덮어쓰지 않는다
- 개인정보 동의는 자동 체크하지 않는다
