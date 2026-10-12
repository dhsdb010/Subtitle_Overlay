// Shared by the popup and the content script.
const SUB_DEFAULTS = {
  enabled: true,
  offset: 0,          // seconds; positive = subtitles appear later
  size: 100,          // % of the base size below
  fontFamily: 'gothic',
  bold: true,
  color: '#ffffff',
  outline: 3,         // relative outline thickness
  outlineColor: '#000000',
  shadow: true,
  bgOpacity: 0,       // 0-100, background box behind the text
  bottom: 8,          // % of video height from the bottom edge
  x: 0,               // horizontal shift, % of video width (set by dragging)
  draggable: true,    // subtitles can be dragged on the video
  useAssStyle: false, // apply colors / bold from the .ass file
  showSigns: true     // show top / positioned "sign" lines at the top
};

// Base subtitle height as % of the video height (size 100%).
const SUB_BASE_FONT = 5.5;

const SUB_FONTS = {
  gothic: '"Apple SD Gothic Neo", "Malgun Gothic", "Noto Sans KR", "Nanum Gothic", sans-serif',
  myeongjo: '"AppleMyungjo", "Nanum Myeongjo", "Noto Serif KR", "Batang", serif',
  rounded: '"NanumSquareRound", "Arial Rounded MT Bold", "Apple SD Gothic Neo", sans-serif'
};
