// The Lumen mark — two layered SVG polygons morphing hexagon -> diamond ->
// triangle -> back to hexagon, counter-rotating. Uses native SVG SMIL
// animation (<animate>, <animateTransform>) instead of CSS clip-path —
// smoother morphing, and it's real vector geometry, not a CSS approximation.
//
// `active` speeds the morph up and brightens the front layer — pass this
// while a chat response is streaming, so the logo itself becomes the
// "thinking" indicator instead of a separate spinner.
export default function LumenLogo({ size = 48, active = false }) {
  const morphDur = active ? '1.4s' : '4s'
  const frontColor = active ? '#5B9EFF' : '#378ADD'
  const backColor = active ? '#8B7FFF' : '#7F77DD'

  // Same 6-point shape at each keyframe so the browser interpolates smoothly
  // between them instead of snapping: hexagon -> diamond -> triangle -> hexagon.
  const shapeKeyframes =
    '50,10 90,30 90,70 50,90 10,70 10,30;' +
    '50,10 90,50 90,50 50,90 10,50 10,50;' +
    '50,10 50,10 90,90 90,90 10,90 10,90;' +
    '50,10 90,30 90,70 50,90 10,70 10,30'

  return (
    <svg width={size} height={size} viewBox="0 0 100 100" style={{ overflow: 'visible' }}>
      <polygon opacity="0.45" fill={backColor}>
        <animate attributeName="points" dur={morphDur} repeatCount="indefinite" values={shapeKeyframes} />
        <animateTransform
          attributeName="transform"
          type="rotate"
          from="0 50 50"
          to="360 50 50"
          dur="9s"
          repeatCount="indefinite"
        />
      </polygon>
      <polygon fill={frontColor}>
        <animate attributeName="points" dur={morphDur} repeatCount="indefinite" values={shapeKeyframes} />
        <animateTransform
          attributeName="transform"
          type="rotate"
          from="360 50 50"
          to="0 50 50"
          dur="6s"
          repeatCount="indefinite"
        />
      </polygon>
    </svg>
  )
}
