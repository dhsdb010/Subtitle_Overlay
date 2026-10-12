# Chrome Web Store listing: Subtitle Overlay

Upload: `dist/subtitle-overlay-1.2.1.zip`
Images: `store/out/`

---

## Store listing tab

**Name** (from manifest): Subtitle Overlay

**Summary** (from manifest, 80 chars):
Show .ass, .srt and .smi subtitles over any web video. v1.2.1 · Made by dhsdb010

**Category:** Accessibility
**Language:** English (add Korean below as a second language if you like)

**Description:**

Watch any web video with your own subtitle file.

Subtitle Overlay puts subtitles from a file on your computer at the bottom center of the video you're watching, just like built-in subtitles, and keeps them in sync with playback. Pause, seek or change speed and the subtitles follow.

FEATURES
• Load .ass / .ssa, .srt and .smi (SAMI) files, by clicking Upload or dragging the file onto the popup
• Korean files in EUC-KR / CP949 and UTF-16 open correctly; multi-language .smi files pick the Korean track automatically
• Subtitle size from 50% to 200%
• Timing fix: shift subtitles earlier or later by 0.1 s or 1 s
• Text color presets plus a built-in color picker with an eyedropper
• Outline thickness and color, background box, font and bold
• Drag the subtitles anywhere on the video, even in fullscreen; the position is remembered
• Sign / top-of-screen text from .ass files is shown at the top
• One switch to turn subtitles on or off

KEYBOARD SHORTCUTS (on the video page)
• Alt/Option + [ or ]: subtitles 0.1 s earlier / later (add Shift for 1 s)
• Alt/Option + \: hide / show subtitles

PRIVACY
Your subtitle file is read on your computer and stored only in your browser's extension storage. Nothing is uploaded, nothing is tracked, and the extension makes no network requests.

**Korean description (optional second language):**

내 자막 파일로 어떤 웹 동영상이든 자막과 함께 보세요.

Subtitle Overlay는 내 컴퓨터에 있는 자막 파일을 보고 있는 동영상의 하단 중앙에 표시하고, 재생에 맞춰 싱크를 맞춰 줍니다. 일시정지, 탐색, 배속 변경에도 자막이 따라갑니다.

기능
• .ass / .ssa, .srt, .smi 자막 지원 (업로드 버튼 또는 팝업에 파일 끌어다 놓기)
• EUC-KR / CP949, UTF-16 한글 자막도 깨지지 않음, 다국어 .smi는 한국어 자막 자동 선택
• 자막 크기 50%~200%
• 싱크 조절: 0.1초 / 1초 단위로 빠르게·느리게
• 글자 색 프리셋 + 스포이드가 있는 색상 선택기
• 외곽선 두께·색, 배경 상자, 글꼴, 굵게
• 자막을 드래그해서 원하는 위치로 이동 (전체화면에서도 가능, 위치 저장)
• 켜기/끄기 스위치 하나로 간단하게

단축키: Option(Alt) + [ / ] 싱크 ±0.1초 (Shift와 함께 ±1초), Option(Alt) + \ 자막 숨기기/보이기

개인정보: 자막 파일은 내 컴퓨터에서만 읽고 브라우저에만 저장됩니다. 업로드, 추적, 네트워크 요청이 없습니다.

**Graphic assets:**
- Store icon 128×128: `icons/icon128.png`
- Screenshots 1280×800: `store/out/screenshot-1-hero.png` … `screenshot-5-drag.png` (upload in this order)
- Small promo tile 440×280: `store/out/promo-small-440x280.png`
- Marquee promo tile 1400×560: `store/out/promo-marquee-1400x560.png`

---

## Privacy practices tab

**Single purpose:**
Display subtitles from a subtitle file the user chooses (.ass, .srt, .smi) on top of web videos, synced to playback.

**Permission justifications:**
- `storage`: saves the user's subtitle settings (size, color, timing, position) and the loaded subtitle lines so they apply to the video on any tab.
- `unlimitedStorage`: a full subtitle file with styling can be several megabytes; this keeps large .ass files from failing to save.
- Host permission (content scripts on all URLs): subtitles must be drawn over the video on whatever site the user is watching. The script only finds the page's <video> element and draws text over it. It doesn't read or send page content.

**Remote code:** No, I am not using remote code. All JavaScript is included in the package.

**Data usage:** don't tick any data type. The extension collects no user data.
Certify all three statements:
- I do not sell or transfer user data to third parties, outside of the approved use cases
- I do not use or transfer user data for purposes that are unrelated to my item's single purpose
- I do not use or transfer user data to determine creditworthiness or for lending purposes

**Privacy policy URL:** not required because no user data is collected. If the form asks for one anyway, publish the short policy below (e.g. as a GitHub Gist or page) and paste its link.

> Subtitle Overlay does not collect, store on any server, or share any personal data. Subtitle files you load are read locally and kept only in your browser's extension storage, which you can clear by removing the subtitle in the popup or uninstalling the extension. The extension makes no network requests.

---

## Distribution tab
- Visibility: Public (or Unlisted if you only want to share the link)
- Regions: all regions
