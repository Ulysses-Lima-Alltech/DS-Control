import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';

type DialogFormProps = {
  title?: string;
  description?: string;
  form: React.ReactNode;
  trigger: React.ReactNode;
  isOpen?: boolean;
  setIsOpen?: (open: boolean) => void;
  className?: string;
};

export default function DialogForm({
  title,
  description,
  form,
  trigger,
  isOpen,
  setIsOpen,
  className,
}: DialogFormProps) {
  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen ? setIsOpen : undefined}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className={className}>
        <DialogHeader>
          <DialogTitle className={!title ? 'sr-only' : ''}>{title}</DialogTitle>
          <DialogDescription className={!description ? 'sr-only' : ''}>
            {description}
          </DialogDescription>
        </DialogHeader>
        {form}
      </DialogContent>
    </Dialog>
  );
}
