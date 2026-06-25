interface JsonLdScriptsProps {
  schemas: unknown[];
}

export default function JsonLdScripts({ schemas }: JsonLdScriptsProps) {
  return (
    <>
      {schemas.map((schema, i) => (
        <script
          key={i}
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }}
        />
      ))}
    </>
  );
}
