import styled, { keyframes } from "styled-components";

const spinAnimation = keyframes`
  0% {
    background-color: currentColor;
    opacity: 1;
  }

  100% {
    background-color: currentColor;
    opacity: 0;
  }
`;

const SpinnerBlade = styled.div`
  position: absolute;
  left: 0.4629em;
  bottom: 0;
  width: 0.074em;
  height: 0.2777em;
  border-radius: 0.0555em;

  background-color: #10b981; /* ✅ fixed color */

  transform-origin: center -0.2222em;
  animation: ${spinAnimation} 1s infinite linear;

  box-shadow: 0 0 4px rgba(16, 185, 129, 0.4);
`;

const Spinner = styled.div`
  font-size: 28px;
  position: relative;
  display: inline-block;
  width: 1em;
  height: 1em;
  color: inherit; /* ✅ IMPORTANT */
`;

const CenteredSpinner = styled(Spinner)`
  position: absolute;
  inset: 0;
  margin: auto;

  color: #10b981 !important; /* ✅ force emerald */
`;

const Loader = ({ className = "" }) => {
  const spinnerBlades = Array.from({ length: 12 }, (_, index) => index + 1);

  return (
    <CenteredSpinner className={className}>
      {spinnerBlades.map((i) => (
        <SpinnerBlade
          key={i}
          style={{
            animationDelay: `${0.083 * (i - 1)}s`,
            transform: `rotate(${30 * (i - 1)}deg)`,
          }}
        />
      ))}
    </CenteredSpinner>
  );
};

export default Loader;
