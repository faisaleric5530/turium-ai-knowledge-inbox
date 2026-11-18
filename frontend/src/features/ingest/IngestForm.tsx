import { FileText, Link2 } from 'lucide-react'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { NoteForm } from './NoteForm'
import { UrlForm } from './UrlForm'

/** Add a note or a web page. Both forms stay mounted so a half-written note survives the switch. */
export function IngestForm({ onViewSaved }: { onViewSaved: () => void }) {
  return (
    <Tabs defaultValue="note">
      <TabsList aria-label="What to add">
        <TabsTrigger value="note">
          <FileText aria-hidden /> Note
        </TabsTrigger>
        <TabsTrigger value="url">
          <Link2 aria-hidden /> Web page
        </TabsTrigger>
      </TabsList>
      <TabsContent value="note" keepMounted>
        <NoteForm onViewSaved={onViewSaved} />
      </TabsContent>
      <TabsContent value="url" keepMounted>
        <UrlForm onViewSaved={onViewSaved} />
      </TabsContent>
    </Tabs>
  )
}
