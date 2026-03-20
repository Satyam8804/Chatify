import styled, { keyframes } from "styled-components";

const spinAnimation = keyframes`
  0% { opacity: 1; }
  100% { opacity: 0; }
`;

const SpinnerBlade = styled.div`
  position: absolute;
  left: 0.4629em;
  bottom: 0;
  width: 0.074em;
  height: 0.2777em;
  border-radius: 0.0555em;
  background-color: #10b981;
  transform-origin: center -0.2222em;
  animation: ${spinAnimation} 1s infinite linear;
`;

const Spinner = styled.div`
  font-size: 28px;
  position: relative;
  display: inline-block;
  width: 1em;
  height: 1em;
`;

const Wrapper = styled.div`
  position: ${({ fullScreen }) => (fullScreen ? "fixed" : "relative")};
  inset: ${({ fullScreen }) => (fullScreen ? "0" : "auto")};
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  background: ${({ fullScreen }) => (fullScreen ? "#020617" : "transparent")};
  z-index: 999;
`;

const Text = styled.p`
  margin-top: 12px;
  font-size: 14px;
  color: #a7f3d0;
`;

const Loader = ({ text = "Loading...", fullScreen = true }) => {
  const spinnerBlades = Array.from({ length: 12 }, (_, i) => i);

  return (
    <Wrapper fullScreen={fullScreen}>
      <Spinner>
        {spinnerBlades.map((i) => (
          <SpinnerBlade
            key={i}
            style={{
              animationDelay: `${i * 0.08}s`,
              transform: `rotate(${i * 30}deg)`,
            }}
          />
        ))}
      </Spinner>

      {text && <Text>{text}</Text>}
    </Wrapper>
  );
};

export default Loader;