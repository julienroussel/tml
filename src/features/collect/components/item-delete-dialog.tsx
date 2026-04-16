"use client";

import { useTranslations } from "next-intl";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

export interface ItemDeleteDialogProps {
  itemName: string | null;
  onConfirm: () => void;
  onOpenChange: (open: boolean) => void;
  open: boolean;
}

export function ItemDeleteDialog({
  itemName,
  open,
  onOpenChange,
  onConfirm,
}: ItemDeleteDialogProps): React.ReactElement {
  const t = useTranslations("collect");

  return (
    <AlertDialog onOpenChange={onOpenChange} open={open}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>
            {t("deleteConfirmTitle", { name: itemName ?? "" })}
          </AlertDialogTitle>
          <AlertDialogDescription>
            {t("deleteConfirmDescription")}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>{t("cancel")}</AlertDialogCancel>
          <AlertDialogAction onClick={onConfirm} variant="destructive">
            {t("deleteConfirm")}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
