import { notFound } from "next/navigation";
import Mailroom from "../mailroom";
export default function DemoPage() {
  if (!import.meta.env.DEV) notFound();
  return <Mailroom demo />;
}
