import './style.css';

export const metadata = {
  title: '아웃바운딩 · 업체 발굴',
  description: '업종과 지역으로 업체를 찾고 출처와 영업 메모를 한곳에서 관리하세요.',
};

export default function Layout({ children }) {
  return <html lang="ko"><body>{children}</body></html>;
}
