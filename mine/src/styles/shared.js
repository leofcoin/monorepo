export * from './elevation'

export const none = `
  * {
    pointer-events: none;
    user-select: none;
    margin: 0;
  }
`

export const input = `input {
  pointer-events: auto;
  color: rgb(255, 255, 255);
  font-weight: 500;
  outline: none;
  border: none;
  flex: 1 1 auto;
  background-color: var(--main-input-background);
  font-size: 24px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  padding: 0px;
  appearance: textfield;
}`

export const hero = `
:host {
  --hero-border-radius: 24px;
  --hero-color: #eee;


  display: flex;
  flex-direction: column;
  padding: 12px;
  box-sizing: border-box;
  max-width: 320px;
  width: 100%;
  max-height: 320px;
  height: 100%;
  align-items: center;
  background: var(--hero-background);
  border-color: var(--hero-border-color);
  border-radius: var(--hero-border-radius);
  color: var(--hero-color);
  box-shadow: 0 2px 2px 0 rgba(0, 0, 0, 0.14),
              0 1px 5px 0 rgba(0, 0, 0, 0.12),
              0 3px 1px -2px rgba(0, 0, 0, 0.2);
}`

export const button = `
button {
    cursor: pointer;
    display: flex;
    flex-direction: column;
    padding: 12px;
    height: 54px;
    box-sizing: border-box;
    border-radius: 20px;
    width: 100%;
    appearance: none;
    outline: none;
    align-items: center;
    justify-content: center;
    font-size: 20px;
    text-transform: capitalize;
    border-color: var(--main-button-color);
    color: var(--main-button-color);
    background: var(--main-button-background);
}`

export const scrollbar = `
::-webkit-scrollbar {
  width: 12px;
}

::-webkit-scrollbar-track {
  -webkit-box-shadow: inset 0 0 6px rgba(0,0,0,0.3);
  border-radius: 10px;
}

::-webkit-scrollbar-thumb {
  border-radius: 10px;
  -webkit-box-shadow: inset 0 0 6px rgba(0,0,0,0.5);
}
`

export const rotate = `
@-webkit-keyframes rotation {
  from {
    -webkit-transform: rotate(0deg);
    -o-transform: rotate(0deg);
    transform: rotate(0deg);
  }
  to {
    -webkit-transform: rotate(360deg);
    -o-transform: rotate(360deg);
    transform: rotate(360deg);
  }
}
@keyframes rotation {
  from {
    -ms-transform: rotate(0deg);
    -moz-transform: rotate(0deg);
    -webkit-transform: rotate(0deg);
    -o-transform: rotate(0deg);
    transform: rotate(0deg);
  }
  to {
    -ms-transform: rotate(360deg);
    -moz-transform: rotate(360deg);
    -webkit-transform: rotate(360deg);
    -o-transform: rotate(360deg);
    transform: rotate(360deg);
  }
}
`

export const rotateBack = `
@-webkit-keyframes rotationBack {
  from {
    -webkit-transform: rotate(0deg);
    -o-transform: rotate(0deg);
    transform: rotate(0deg);
  }
  to {
    -webkit-transform: rotate(-360deg);
    -o-transform: rotate(-360deg);
    transform: rotate(-360deg);
  }
}
@keyframes rotationBack {
  from {
    -ms-transform: rotate(0deg);
    -moz-transform: rotate(0deg);
    -webkit-transform: rotate(0deg);
    -o-transform: rotate(0deg);
    transform: rotate(0deg);
  }
  to {
    -ms-transform: rotate(-360deg);
    -moz-transform: rotate(-360deg);
    -webkit-transform: rotate(-360deg);
    -o-transform: rotate(-360deg);
    transform: rotate(-360deg);
  }
}
`

export const basicRotationBack = `
-webkit-animation: rotationBack 2s linear infinite;
-moz-animation: rotationBack 2s linear infinite;
-ms-animation: rotationBack 2s linear infinite;
-o-animation: rotationBack 2s linear infinite;
animation: rotationBack 2s linear infinite;
`

export const basicRotation = `
-webkit-animation: rotation 2s linear infinite;
-moz-animation: rotation 2s linear infinite;
-ms-animation: rotation 2s linear infinite;
-o-animation: rotation 2s linear infinite;
animation: rotation 2s linear infinite;
`
