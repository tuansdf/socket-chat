import BModal from "bootstrap/js/dist/modal";
import { createEffect, JSX, onCleanup, onMount } from "solid-js";

type Props = {
  isOpen?: boolean;
  onClose?: (...args: any[]) => any;
  title?: string;
  children?: JSX.Element;
};

export const Modal = (props: Props) => {
  let modalRef: HTMLDivElement;
  let modal: BModal | undefined;

  const getModal = (): BModal | undefined => {
    if (!modal) {
      modal = new BModal(modalRef);
    }
    return modal;
  };

  const openModal = () => {
    getModal()?.show();
  };

  const closeModal = () => {
    modal?.hide();
  };

  createEffect(() => {
    if (props.isOpen) {
      openModal();
    } else {
      closeModal();
    }
  });

  onMount(() => {
    getModal();
    modalRef?.addEventListener("hide.bs.modal", () => {
      props.onClose?.();
    });
  });

  onCleanup(() => {
    modal?.dispose();
  });

  return (
    <div class="modal fade" ref={modalRef} tabIndex="-1" aria-hidden="true">
      <div class="modal-dialog modal-dialog-centered">
        <div class="modal-content">
          <div class="modal-header">
            <h1 class="modal-title fs-5">{props.title}</h1>
            <button type="button" class="btn-close" aria-label="Close" data-bs-dismiss="modal"></button>
          </div>

          <div class="modal-body">{props.children}</div>

          <div class="modal-footer">
            <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
