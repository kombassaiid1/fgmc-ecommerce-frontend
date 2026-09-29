"use client";

import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Badge,
  Banner,
  BlockStack,
  Box,
  Button,
  Card,
  Divider,
  IndexTable,
  InlineStack,
  Text,
  TextField,
  useIndexResourceState,
} from "@shopify/polaris";
import { RefreshIcon } from "@shopify/polaris-icons";

import { getClients, type Client } from "@/lib/api/clients";

async function getAllClients() {
  const firstPage = await getClients({ page: 1, limit: 100 });
  if (firstPage.meta.totalPages <= 1) return firstPage;

  const remainingPages = await Promise.all(
    Array.from({ length: firstPage.meta.totalPages - 1 }, (_, index) =>
      getClients({ page: index + 2, limit: 100 }),
    ),
  );

  return {
    data: [firstPage, ...remainingPages].flatMap((page) => page.data),
    meta: firstPage.meta,
  };
}

function getClientDisplayName(client: Client) {
  return `${client.firstName} ${client.lastName}`.trim() || client.email;
}

function includesClientQuery(client: Client, query: string) {
  const searchable = [
    client.Titre,
    client.email,
    client.username,
    client.firstName,
    client.lastName,
    client.company,
    client.numberIdFiscale,
    client.dateOfBirth,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  return searchable.includes(query);
}

export default function AdminClientsPage() {
  const [search, setSearch] = useState("");

  const clientsQuery = useQuery({
    queryKey: ["admin-clients"],
    queryFn: getAllClients,
  });

  const clients = useMemo(
    () =>
      [...(clientsQuery.data?.data ?? [])].sort((a, b) =>
        getClientDisplayName(a).localeCompare(getClientDisplayName(b)),
      ),
    [clientsQuery.data],
  );

  const filteredClients = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) {
      return clients;
    }

    return clients.filter((client) => includesClientQuery(client, query));
  }, [clients, search]);

  const {
    selectedResources,
    allResourcesSelected,
    handleSelectionChange,
  } = useIndexResourceState(filteredClients, {
    resourceIDResolver: (item) => item.id,
  });

  const errorMessage =
    clientsQuery.error instanceof Error
      ? clientsQuery.error.message
      : "Impossible de charger les clients.";

  return (
    <BlockStack gap="500">
      <Card>
        <BlockStack gap="300">
          <InlineStack align="space-between" blockAlign="start" gap="300">
            <BlockStack gap="100">
              <Text as="h2" variant="headingLg">
                Clients
              </Text>
              <Text as="p" tone="subdued">
                Liste des comptes clients inscrits sur la boutique.
              </Text>
            </BlockStack>
            <Button
              icon={RefreshIcon}
              accessibilityLabel="Actualiser les clients"
              loading={clientsQuery.isFetching}
              onClick={() => void clientsQuery.refetch()}
            >
              Actualiser
            </Button>
          </InlineStack>

          <InlineStack gap="200">
            <Badge tone="info">{`Total: ${String(clients.length)}`}</Badge>
            <Badge tone="success">{`Affiches: ${String(filteredClients.length)}`}</Badge>
          </InlineStack>
        </BlockStack>
      </Card>

      {clientsQuery.isError ? (
        <Banner tone="critical" title={errorMessage} />
      ) : null}

      <Card>
        <BlockStack gap="300">
          <Box minWidth="280px" width="45%">
            <TextField
              label="Recherche"
              placeholder="Nom, email, societe, identifiant..."
              value={search}
              onChange={setSearch}
              autoComplete="off"
              clearButton
              onClearButtonClick={() => setSearch("")}
            />
          </Box>

          <Divider />

          <IndexTable
            selectable
            loading={clientsQuery.isLoading}
            resourceName={{ singular: "client", plural: "clients" }}
            itemCount={filteredClients.length}
            selectedItemsCount={
              allResourcesSelected ? "All" : selectedResources.length
            }
            onSelectionChange={handleSelectionChange}
            emptyState={
              <Box padding="400">
                <Text as="p" tone="subdued">
                  Aucun client avec les filtres actuels.
                </Text>
              </Box>
            }
            headings={[
              { title: "Client" },
              { title: "Titre" },
              { title: "Email" },
              { title: "Identifiant" },
              { title: "Societe" },
              { title: "ID fiscal" },
              { title: "Date naissance" },
            ]}
          >
            {filteredClients.map((client, index) => (
              <IndexTable.Row
                id={client.id}
                key={client.id}
                position={index}
                selected={selectedResources.includes(client.id)}
                onClick={() => {}}
              >
                <IndexTable.Cell>
                  <BlockStack gap="050">
                    <Text as="span" fontWeight="semibold">
                      {getClientDisplayName(client)}
                    </Text>
                    <Text as="span" tone="subdued">
                      {client.id}
                    </Text>
                  </BlockStack>
                </IndexTable.Cell>
                <IndexTable.Cell>{client.Titre}</IndexTable.Cell>
                <IndexTable.Cell>{client.email}</IndexTable.Cell>
                <IndexTable.Cell>{client.username || "-"}</IndexTable.Cell>
                <IndexTable.Cell>{client.company || "-"}</IndexTable.Cell>
                <IndexTable.Cell>
                  {client.numberIdFiscale || "-"}
                </IndexTable.Cell>
                <IndexTable.Cell>{client.dateOfBirth || "-"}</IndexTable.Cell>
              </IndexTable.Row>
            ))}
          </IndexTable>
        </BlockStack>
      </Card>
    </BlockStack>
  );
}
