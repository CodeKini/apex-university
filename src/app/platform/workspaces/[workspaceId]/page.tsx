import { redirect } from 'next/navigation'

export default function WorkspaceAdminRootPage({ params }: { params: { workspaceId: string } }) {
  redirect(`/platform/workspaces/${params.workspaceId}/analytics`)
}
