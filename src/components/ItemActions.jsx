import PixelIcon from './PixelIcon'

/**
 * 목록 항목(인용구, 감상문, 회차) 오른쪽 위의 작은 아이콘 버튼 묶음.
 * 도구 모음과 같은 98식 평평한 버튼이며, 이름은 툴팁으로 보여 줍니다.
 * actions: [{ icon, label, onClick, danger? }] — danger(삭제)는 구분선으로 조금 떨어뜨립니다.
 */
export default function ItemActions({ actions }) {
  return (
    <span className="item-actions">
      {actions.map((action, i) => (
        <span key={action.label} className="item-actions__slot">
          {action.danger && i > 0 && <span className="item-actions__separator" aria-hidden="true" />}
          <button
            type="button"
            className="item-actions__button"
            title={action.label}
            aria-label={action.label}
            onClick={action.onClick}
          >
            <PixelIcon name={action.icon} centered />
          </button>
        </span>
      ))}
    </span>
  )
}
