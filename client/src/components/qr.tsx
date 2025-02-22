import QRCode from "qrcode";
import { createEffect, createUniqueId } from "solid-js";

type Props = {
  content: string;
};

export const QR = (props: Props) => {
  let ref!: HTMLCanvasElement;
  const id = createUniqueId();

  createEffect(async () => {
    await QRCode.toCanvas(document.getElementById(id), props.content, {
      width: 240,
      errorCorrectionLevel: "Q",
      margin: 2,
    });
  });

  return <canvas ref={ref} id={id}></canvas>;
};
